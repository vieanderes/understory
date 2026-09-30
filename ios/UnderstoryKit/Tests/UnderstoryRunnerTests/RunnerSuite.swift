import Testing

/// Every runner suite, one test at a time.
///
/// The JavaScriptCore watchdog counts the CPU time of the run's thread, while the host's
/// deadline counts the wall clock. With a dozen tsx runs, a WebKit content process and a
/// spinning loop all in parallel, a spinning thread can get too little CPU to reach its
/// budget before the host gives up on it, and the test then sees the host deadline where
/// it asserts the watchdog. Serialised, the cause the tests check is the cause that ran.
@Suite(.serialized) enum RunnerSuite {}
