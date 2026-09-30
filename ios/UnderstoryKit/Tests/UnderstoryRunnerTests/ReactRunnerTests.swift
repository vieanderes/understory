import Foundation
import Testing

@testable import UnderstoryRunner

/// tsx on JavaScriptCore: the committed React runtime, the same harness and the same
/// Sucrase as the browser and the Node gate. The fixture is the one the Node gate's own
/// test uses (tests/unit/adapters/node-runner/react.test.ts), so the verdicts compare.
extension RunnerSuite {
@Suite struct ReactRunnerTests {
  static let fixture = JavaScriptRunnerTests.repoRoot.appending(
    path: "tests/fixtures/react-challenge")

  static func read(_ name: String) throws -> String {
    try String(contentsOf: fixture.appending(path: name), encoding: .utf8)
  }

  static func runTsx(_ code: String, _ tests: String, timeoutMs: Int = 10_000) async throws
    -> (result: RunResult, diagnostics: JavaScriptRunner.Diagnostics)
  {
    try await JavaScriptRunner().runWithDiagnostics(
      JavaScriptRunnerTests.request(code: code, tests: tests, language: .tsx, timeoutMs: timeoutMs))
  }

  @Test("the embedded React runtime is the one the web serves")
  func runtimeIsInStep() throws {
    let embedded = try #require(JavaScriptRunner.resource("react-runtime.v1", "js"))
    let served = try String(
      contentsOf: JavaScriptRunnerTests.repoRoot.appending(path: "public/sandbox/react-runtime.v1.js"),
      encoding: .utf8)
    #expect(
      embedded == served,
      "The embedded React runtime is stale. Run ios/UnderstoryKit/Scripts/sync-resources.sh")
  }

  @Test("the reference component passes every test", .timeLimit(.minutes(1)))
  func solutionPasses() async throws {
    let (result, _) = try await Self.runTsx(Self.read("solution.tsx"), Self.read("tests.tsx"))
    #expect(result.tests.filter { !$0.passed } == [])
    #expect(result.status == .passed, "\(result)")
    #expect(result.tests.count == 4)
  }

  @Test("the starter fails with Testing Library's message", .timeLimit(.minutes(1)))
  func starterFails() async throws {
    let (result, _) = try await Self.runTsx(Self.read("starter.tsx"), Self.read("tests.tsx"))
    #expect(result.status == .failed)
    #expect(result.tests.count == 4)
    #expect(
      result.tests.first?.message?.contains(
        "Unable to find an accessible element with the role \"combobox\"") == true)
  }

  @Test("every test starts on an empty page, and a throwing handler fails its test")
  func cleanPageAndThrowingHandler() async throws {
    let (result, _) = try await Self.runTsx(
      """
      export function Boom() {
        return <button onClick={() => { throw new Error('handler broke'); }}>Boom</button>;
      }
      """,
      """
      import { render, screen, fireEvent } from '@testing-library/react';
      import { Boom } from './solution';
      test('throws', () => {
        render(<Boom />);
        fireEvent.click(screen.getByRole('button'));
      });
      test('clean page', () => {
        expect(document.body.children).toHaveLength(0);
        render(<Boom />);
        expect(screen.getAllByRole('button')).toHaveLength(1);
      });
      """)
    #expect(
      result.tests == [
        TestResult(name: "throws", passed: false, message: "Error: handler broke"),
        TestResult(name: "clean page", passed: true),
      ])
  }

  @Test("waitFor polls on the runner's timers")
  func waitForUsesTimers() async throws {
    let (result, _) = try await Self.runTsx(
      """
      import { useEffect, useState } from 'react';
      export function Later() {
        const [text, setText] = useState('waiting');
        useEffect(() => {
          const id = setTimeout(() => setText('ready'), 30);
          return () => clearTimeout(id);
        }, []);
        return <p>{text}</p>;
      }
      """,
      """
      import { render, screen, waitFor } from '@testing-library/react';
      import { Later } from './solution';
      test('shows ready', async () => {
        render(<Later />);
        expect(screen.getByText('waiting')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());
      });
      """)
    #expect(result.status == .passed, "\(result)")
  }

  @Test("a component that renders for ever is stopped and reported as a timeout",
    .timeLimit(.minutes(1)))
  func endlessRender() async throws {
    try #require(ExecutionTimeLimit.isEnabled, "the JavaScriptCore watchdog is off")
    let (result, diagnostics) = try await Self.runTsx(
      "export function Spin() { while (true) {} return <p />; }",
      """
      import { render } from '@testing-library/react';
      import { Spin } from './solution';
      test('renders', () => { render(<Spin />); });
      """, timeoutMs: 1_000)
    #expect(result.status == .timeout)
    #expect(diagnostics.stoppedByWatchdog)
  }

  @Test("a JSX syntax error in the learner's code carries its line")
  func jsxSyntaxError() async throws {
    let (result, _) = try await Self.runTsx(
      "export function A() {\n  return <p>unclosed;\n}", "test('t', () => {});")
    #expect(result.status == .error)
    #expect(result.error?.name == "SyntaxError")
    #expect(result.error?.line != nil)
  }
}
}  // extension RunnerSuite
