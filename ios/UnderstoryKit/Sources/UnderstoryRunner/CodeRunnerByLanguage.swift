/// One runner in front of two, as `byLanguage` in src/core/running/by-language.ts:
/// Python to `PythonRunner`, everything else to `JavaScriptRunner`. `PythonRunner` is
/// lazy on its own, so holding one costs nothing until a Python run arrives.
public struct CodeRunnerByLanguage: CodeRunner {
  public let script: any CodeRunner
  public let python: any CodeRunner

  public init(script: any CodeRunner, python: any CodeRunner) {
    self.script = script
    self.python = python
  }

  public func run(_ request: RunRequest) async -> RunResult {
    request.language == .python ? await python.run(request) : await script.run(request)
  }
}
