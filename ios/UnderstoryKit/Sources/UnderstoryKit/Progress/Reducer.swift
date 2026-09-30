import Foundation

/// The pure fold from an event log to a read model (src/core/progress/reducer.ts).
///
/// `reduce` de-duplicates by id and sorts by (at, deviceId, seq), so the union of two
/// devices' logs gives the same state in any order (docs/SYNC-PROTOCOL.md).
public enum Reducer {
  /// 2: `capstoneAdrs` joined the state.
  public static let version = 2

  /// C: "repeating the same item within 24 hours earns 0."
  public static let grindingCooldownMs: Double = 24 * 60 * 60 * 1_000

  public static func reduce(_ events: [LoggedEvent]) -> ProgressState {
    reduce(events.compactMap(\.known))
  }

  public static func reduce(_ events: [StoryEvent]) -> ProgressState {
    var seen = Set<String>()
    let ordered =
      events
      .filter { seen.insert($0.id).inserted }
      .sorted(by: precedes)
    return ordered.reduce(into: ProgressState()) { apply($1, to: &$0) }
  }

  /// (at, deviceId, seq), compared as the web compares them: `at` and `deviceId` as
  /// JavaScript strings, `seq` as a number. The id is a last tie-break that the web does
  /// not have (docs/ios/CONTRACT.md, known issue K3): without it two events with equal
  /// keys would keep their input order, and the fold would not be order-insensitive.
  static func precedes(_ a: StoryEvent, _ b: StoryEvent) -> Bool {
    if a.at != b.at { return JSMath.stringPrecedes(a.at, b.at) }
    if a.deviceId != b.deviceId { return JSMath.stringPrecedes(a.deviceId, b.deviceId) }
    if a.seq != b.seq { return a.seq < b.seq }
    return JSMath.stringPrecedes(a.id, b.id)
  }

  public static func apply(_ event: StoryEvent, to state: inout ProgressState) {
    // `upcast` has already checked `at`, and an event built in code is the caller's
    // responsibility, so a bad instant is treated as the epoch and not as a crash.
    let atMs = Instant.milliseconds(event.at) ?? 0
    let at = Date(timeIntervalSince1970: atMs / 1_000)

    switch event.payload {
    case .placementAnswered(let payload):
      state.calibrationAnswers.append(
        CalibrationAnswer(
          confidence: payload.confidence, correct: payload.correct, moduleId: payload.moduleId))

    case .placementCompleted(let payload):
      for concept in payload.assumedConcepts {
        state.assumedConcepts.insert(concept)
        state.concepts[concept, default: ConceptRecord()].assumed = true
      }
      state.thetaByModule.merge(payload.thetaByModule) { _, new in new }

    case .stepAnswered(let payload):
      let itemKey = "\(payload.lessonId)#\(payload.stepId)"
      let family = payload.stepType.family
      var record = state.concepts[payload.concept] ?? ConceptRecord()
      record.p = Mastery.updateSkill(p: record.p, score: payload.score, family: family)
      if payload.correct {
        record.familiesPassed.insert(family)
        record.successLocalDates.append(event.localDate)
        if family == .produce { record.produceOrExplainPassed = true }
      }
      record.attemptCount += 1

      let xp = Gamification.xp(
        for: .init(
          kind: Gamification.xpKind(for: payload.stepType), score: payload.score,
          wasScheduled: true,
          challengeFirstWrongAttempt: payload.mode == .challengeFirst && !payload.correct,
          withinCooldown: withinCooldown(state, itemKey, atMs)))

      state.concepts[payload.concept] = record
      addXp(&state, event.localDate, xp)
      state.lastGradedAt[itemKey] = event.at
      if payload.stepType == .aiReview && payload.correct { state.aiReviewsPassed += 1 }
      if let confidence = payload.confidence {
        state.calibrationAnswers.append(
          CalibrationAnswer(confidence: confidence, correct: payload.correct))
      }
      refreshSolidHistory(&state, payload.concept, at)

    case .reviewGraded(let payload):
      let priorCard = state.cards[payload.cardKey]
      // The XP check below reads the state before this event, as the web does.
      let cooldown = withinCooldown(state, payload.cardKey, atMs)
      if priorCard == nil && state.cardConcept[payload.cardKey] == nil {
        state.cardOrder.append(payload.cardKey)
      }
      state.cards[payload.cardKey] = payload.state
      state.cardConcept[payload.cardKey] = payload.concept
      // A concept can have memory evidence with no skill attempt yet.
      if state.concepts[payload.concept] == nil { state.concepts[payload.concept] = ConceptRecord() }

      if payload.isFactCard {
        let wasScheduled = priorCard.map { (Instant.milliseconds($0.due) ?? 0) <= atMs } ?? true
        let xp = Gamification.xp(
          for: .init(
            kind: .recall, score: scoreFromRating(payload.rating),
            retrievabilityBefore: payload.retrievabilityBefore, wasScheduled: wasScheduled,
            withinCooldown: cooldown))
        addXp(&state, event.localDate, xp)
        state.lastGradedAt[payload.cardKey] = event.at
      }
      refreshSolidHistory(&state, payload.concept, at)

    case .lessonCompleted(let payload):
      state.completedLessons.insert(payload.lessonId)

    case .explainBackGraded(let payload):
      let itemKey = "\(payload.lessonId)#\(payload.stepId)"
      let score = Gamification.explainBackSelfGradeToScore[payload.rubricHits]
      let passed = payload.rubricHits == 3
      var record = state.concepts[payload.concept] ?? ConceptRecord()
      record.p = Mastery.updateSkill(p: record.p, score: score, family: .produce)
      if passed {
        record.familiesPassed.insert(.produce)
        record.produceOrExplainPassed = true
        record.successLocalDates.append(event.localDate)
      }
      record.attemptCount += 1
      let xp = Gamification.xp(
        for: .init(
          kind: .bugHuntAiReviewExplain, score: score,
          withinCooldown: withinCooldown(state, itemKey, atMs)))
      state.concepts[payload.concept] = record
      addXp(&state, event.localDate, xp)
      state.lastGradedAt[itemKey] = event.at
      refreshSolidHistory(&state, payload.concept, at)

    case .capstoneCompleted(let payload):
      let itemKey = "capstone#\(payload.moduleId)"
      let xp = Gamification.xp(
        for: .init(kind: .capstone, score: 1, withinCooldown: withinCooldown(state, itemKey, atMs)))
      state.completedCapstones.insert(payload.moduleId)
      addXp(&state, event.localDate, xp)
      state.lastGradedAt[itemKey] = event.at

    case .capstoneAdrWritten(let payload):
      let previous = state.capstoneAdrs[payload.partId]
      state.capstoneAdrs[payload.partId] = CapstoneAdr(
        partId: payload.partId, title: payload.title, context: payload.context,
        decision: payload.decision, alternatives: payload.alternatives,
        consequences: payload.consequences,
        firstWrittenOn: previous?.firstWrittenOn ?? event.localDate,
        updatedOn: event.localDate, revisions: (previous?.revisions ?? 0) + 1)

    case .incidentResolved(let payload):
      let itemKey = "incident#\(payload.incidentId)"
      let xp = Gamification.xp(
        for: .init(
          kind: .incident, score: payload.score,
          withinCooldown: withinCooldown(state, itemKey, atMs)))
      state.resolvedIncidents.append(payload)
      addXp(&state, event.localDate, xp)
      state.lastGradedAt[itemKey] = event.at

    case .testOutAttempted(let payload):
      let itemKey = "testout#\(payload.moduleId)"
      let cooldown = withinCooldown(state, itemKey, atMs)
      state.testOuts[payload.moduleId, default: []].append(
        TestOutAttempt(score: payload.score, passed: payload.passed, at: event.at))
      if payload.passed {
        let xp = Gamification.xp(for: .init(kind: .testOut, score: 1, withinCooldown: cooldown))
        addXp(&state, event.localDate, xp)
        state.lastGradedAt[itemKey] = event.at
      }

    case .goalTierSet(let payload):
      state.goalTier = payload.tier

    case .modeSet(let payload):
      state.modeByModule[payload.moduleId] = payload.mode

    case .settingChanged(let payload):
      state.settings[payload.key] = payload.value

    case .readingCollected(let payload):
      state.collectedReadings.insert(payload.referenceKey)

    case .aiHoursReported, .sessionStarted, .sessionFinished:
      // Facts kept for their own features. Nothing here derives from them yet.
      break
    }
  }

  // MARK: - Helpers

  private static func withinCooldown(_ state: ProgressState, _ itemKey: String, _ atMs: Double)
    -> Bool
  {
    guard let last = state.lastGradedAt[itemKey], let lastMs = Instant.milliseconds(last) else {
      return false
    }
    return atMs - lastMs < grindingCooldownMs
  }

  private static func addXp(_ state: inout ProgressState, _ localDate: String, _ amount: Int) {
    if amount == 0 { return }
    state.xpByLocalDate[localDate, default: 0] += amount
  }

  /// Recomputes `wasEverSolidOrFluent` for one concept at the time of the event.
  private static func refreshSolidHistory(_ state: inout ProgressState, _ concept: String, _ now: Date) {
    guard let record = state.concepts[concept], !record.wasEverSolidOrFluent else { return }
    if state.mastery(of: concept, now: now) >= Mastery.solidThreshold {
      state.concepts[concept]?.wasEverSolidOrFluent = true
    }
  }

  /// B4's `s` for a recall-card review, from the coarser FSRS rating. It reuses the
  /// explain-back self-grade scale (LEARNING-SCIENCE.md, Implementation notes).
  static func scoreFromRating(_ rating: FsrsRating) -> Double {
    Gamification.explainBackSelfGradeToScore[rating.rawValue - 1]
  }
}
