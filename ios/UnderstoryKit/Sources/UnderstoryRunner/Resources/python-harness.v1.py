# Understory Python test harness v1. Generated from src/core/running/python-harness.ts.
import ast as _ast
import builtins as _builtins
import gc as _gc
import json as _json
import linecache as _linecache
import math as _math
import re as _re
import sys as _sys
import traceback as _traceback
import types as _types

# Kept in step with src/core/running/limits.ts by a unit test.
MAX_LOG_LINES = 200
MAX_LOG_BYTES = 65536
MAX_LOG_LINE_LENGTH = 4000
MAX_TESTS = 200
MAX_NAME_LENGTH = 200
MAX_MESSAGE_LENGTH = 2000
TRUNCATION_NOTICE = '[Output truncated: more than 200 lines or 64 KB]'
CODE_FILE = 'solution.py'
TESTS_FILE = 'tests.py'

_ONLY = _re.compile(r'\A__only = (-?\d+)\r?\n')
_BASE_BUILTINS = dict(_builtins.__dict__)
_BASE_MODULES = set(_sys.modules)
_BASE_RECURSION = _sys.getrecursionlimit()
_SCALARS = (int, float, complex, str, bytes, bool)


def _clip(text, limit):
    return text if len(text) <= limit else text[: limit - 3] + '...'


def _format(value):
    # A broken __repr__ in learner data must not stop a message from coming out.
    try:
        return _clip(repr(value), MAX_MESSAGE_LENGTH // 4)
    except Exception:
        return '[Unformattable value]'


def _format_typed(value):
    return _format(value) + ' (' + type(value).__name__ + ')'


class _Failure(AssertionError):
    """A failed expectation. Its message is shown as it is."""


def _fail(message):
    raise _Failure(_clip(message, MAX_MESSAGE_LENGTH))


def _describe_raised(error):
    text = str(error)
    return type(error).__name__ + (': ' + text if text else '')


class _Run:
    """Everything one run owns. A new one per run, so nothing leaks into the next."""

    def __init__(self, host_log, only):
        self.host_log = host_log
        self.only = only
        self.logs = []
        self.log_bytes = 0
        self.truncated = False
        self.partial = {'out': '', 'err': ''}
        self.registered = []
        self.seen = -1
        self.groups = []
        self.started = False

    # ---- output capture -------------------------------------------------------------

    def emit(self, line):
        self.logs.append(line)
        if self.host_log is not None:
            try:
                self.host_log(line)
            except Exception:
                pass

    def record(self, line):
        if self.truncated:
            return
        line = _clip(line, MAX_LOG_LINE_LENGTH)
        if len(self.logs) >= MAX_LOG_LINES or self.log_bytes + len(line) + 1 > MAX_LOG_BYTES:
            self.truncated = True
            self.emit(TRUNCATION_NOTICE)
            return
        self.log_bytes += len(line) + 1
        self.emit(line)

    def write(self, stream, text):
        prefix = 'error: ' if stream == 'err' else ''
        pending = self.partial[stream] + str(text)
        lines = pending.split('\n')
        self.partial[stream] = lines.pop()
        for line in lines:
            self.record(prefix + line)

    def flush_partial(self):
        for stream in ('out', 'err'):
            if self.partial[stream]:
                self.write(stream, '\n')

    def printed(self):
        lines = list(self.logs)
        if self.partial['out']:
            lines.append(self.partial['out'])
        return lines

    # ---- registry -------------------------------------------------------------------

    def register(self, name, fn):
        if self.started:
            raise RuntimeError('test() cannot be called inside a test')
        self.seen += 1
        if self.only is not None:
            if self.only < 0:
                fn = lambda: None
            elif self.seen != self.only:
                return
        if len(self.registered) >= MAX_TESTS:
            return
        full = ' > '.join(self.groups + [str(name)])
        self.registered.append((_clip(full, MAX_NAME_LENGTH), fn))


class _Stream:
    def __init__(self, run, name):
        self._run = run
        self._name = name

    def write(self, text):
        self._run.write(self._name, text)
        return len(str(text))

    def flush(self):
        pass

    def isatty(self):
        return False


# ---- expect -------------------------------------------------------------------------


def _numbers(name, actual, expected):
    ok = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    if not ok(actual) or not ok(expected):
        _fail(name + ' compares numbers, received ' + _format(actual) + ' and ' + _format(expected))


def _contains(container, item):
    if isinstance(container, str):
        return str(item) in container
    try:
        return item in container
    except TypeError:
        return False


class _Expect:
    def __init__(self, actual, negated=False):
        self._actual = actual
        self._negated = negated

    @property
    def not_(self):
        return _Expect(self._actual, not self._negated)

    def _check(self, passed, message, negated_message):
        if self._negated:
            if passed:
                _fail(negated_message)
        elif not passed:
            _fail(message)

    def to_equal(self, expected):
        actual = self._actual
        passed = actual == expected
        message = 'Expected ' + _format(expected) + ', received ' + _format(actual)
        if not passed and _format(actual) == _format(expected):
            message = 'Expected ' + _format_typed(expected) + ', received ' + _format_typed(actual)
        self._check(passed, message, 'Expected a value not equal to ' + _format(expected))

    def to_be(self, expected):
        actual = self._actual
        # Two equal numbers or strings may or may not be the same object, depending on how
        # they were made. Only their type and value can matter to a learner.
        if isinstance(expected, _SCALARS):
            passed = type(actual) is type(expected) and actual == expected
            if not passed and actual == expected:
                message = 'Expected ' + _format_typed(expected) + ', received ' + _format_typed(actual)
            else:
                message = 'Expected ' + _format(expected) + ', received ' + _format(actual)
        else:
            passed = actual is expected
            hint = ''
            if not passed and actual == expected:
                hint = ' (equal, but not the same object: use to_equal)'
            message = 'Expected ' + _format(expected) + ', received ' + _format(actual) + hint
        self._check(passed, message, 'Expected anything but ' + _format(expected))

    def to_be_none(self):
        self._check(self._actual is None, 'Expected None, received ' + _format(self._actual), 'Expected anything but None')

    def to_be_truthy(self):
        self._check(bool(self._actual), 'Expected a truthy value, received ' + _format(self._actual), 'Expected a falsy value, received ' + _format(self._actual))

    def to_be_falsy(self):
        self._check(not self._actual, 'Expected a falsy value, received ' + _format(self._actual), 'Expected a truthy value, received ' + _format(self._actual))

    def to_be_instance_of(self, cls):
        if not isinstance(cls, type):
            _fail('to_be_instance_of needs a class, received ' + _format(cls))
        self._check(isinstance(self._actual, cls), 'Expected an instance of ' + cls.__name__ + ', received ' + _format_typed(self._actual), 'Expected a value that is not an instance of ' + cls.__name__)

    def to_contain(self, item):
        actual = self._actual
        self._check(_contains(actual, item), 'Expected ' + _format(actual) + ' to contain ' + _format(item), 'Expected ' + _format(actual) + ' not to contain ' + _format(item))

    def to_have_length(self, expected):
        actual = self._actual
        try:
            length = len(actual)
        except TypeError:
            _fail('to_have_length needs a value with a length, received ' + _format(actual))
        self._check(length == expected, 'Expected length ' + _format(expected) + ', received length ' + str(length) + ' for ' + _format(actual), 'Expected a length other than ' + _format(expected))

    def to_match(self, pattern):
        actual = self._actual
        if not isinstance(actual, str):
            _fail('to_match needs a string, received ' + _format(actual))
        found = _re.search(pattern, actual) is not None
        self._check(found, 'Expected ' + _format(actual) + ' to match ' + _format(pattern), 'Expected ' + _format(actual) + ' not to match ' + _format(pattern))

    def to_be_close_to(self, expected, digits=2):
        actual = self._actual
        _numbers('to_be_close_to', actual, expected)
        passed = actual == expected or abs(expected - actual) < (10 ** -digits) / 2
        self._check(passed, 'Expected ' + _format(expected) + ' to ' + str(digits) + ' decimal places, received ' + _format(actual), 'Expected a value not close to ' + _format(expected) + ', received ' + _format(actual))

    def to_be_greater_than(self, expected):
        _numbers('to_be_greater_than', self._actual, expected)
        self._check(self._actual > expected, 'Expected a value greater than ' + _format(expected) + ', received ' + _format(self._actual), 'Expected a value not greater than ' + _format(expected) + ', received ' + _format(self._actual))

    def to_be_greater_than_or_equal(self, expected):
        _numbers('to_be_greater_than_or_equal', self._actual, expected)
        self._check(self._actual >= expected, 'Expected a value of at least ' + _format(expected) + ', received ' + _format(self._actual), 'Expected a value below ' + _format(expected) + ', received ' + _format(self._actual))

    def to_be_less_than(self, expected):
        _numbers('to_be_less_than', self._actual, expected)
        self._check(self._actual < expected, 'Expected a value less than ' + _format(expected) + ', received ' + _format(self._actual), 'Expected a value not less than ' + _format(expected) + ', received ' + _format(self._actual))

    def to_be_less_than_or_equal(self, expected):
        _numbers('to_be_less_than_or_equal', self._actual, expected)
        self._check(self._actual <= expected, 'Expected a value of at most ' + _format(expected) + ', received ' + _format(self._actual), 'Expected a value above ' + _format(expected) + ', received ' + _format(self._actual))

    def to_raise(self, expected=None, match=None):
        call = self._actual
        if not callable(call):
            _fail('to_raise needs a function. Wrap the call: expect(lambda: run()).to_raise(ValueError)')
        raised = None
        returned = None
        try:
            returned = call()
        except Exception as error:
            raised = error
        wanted = 'an error'
        matches = raised is not None
        if expected is not None:
            wanted = 'a ' + expected.__name__
            matches = matches and isinstance(raised, expected)
        if match is not None:
            wanted += ' matching ' + _format(match)
            matches = matches and _re.search(match, str(raised)) is not None
        got = 'it raised ' + _describe_raised(raised) if raised is not None else 'it returned ' + _format(returned)
        self._check(matches, 'Expected the function to raise ' + wanted + ', but ' + got, 'Expected the function not to raise ' + wanted + ', but ' + got)


# ---- plain assert ---------------------------------------------------------------------
# "assert total(xs) == 6" should fail with both values, as pytest does, so the tests are
# rewritten: each comparison keeps its operands in two names the message can read.
# Only the tests are rewritten. The learner's own asserts behave as Python's do.

_OPERATORS = {
    _ast.Eq: '==', _ast.NotEq: '!=', _ast.Lt: '<', _ast.LtE: '<=', _ast.Gt: '>',
    _ast.GtE: '>=', _ast.In: 'in', _ast.NotIn: 'not in', _ast.Is: 'is', _ast.IsNot: 'is not',
}


def _explain(left, operator, right):
    if operator == '==':
        if _format(left) == _format(right):
            return 'Expected ' + _format_typed(right) + ', received ' + _format_typed(left)
        return 'Expected ' + _format(right) + ', received ' + _format(left)
    return 'Expected ' + _format(left) + ' ' + operator + ' ' + _format(right)


class _AssertRewriter(_ast.NodeTransformer):
    def visit_Assert(self, node):
        test = node.test
        if node.msg is not None or not isinstance(test, _ast.Compare) or len(test.ops) != 1:
            return node
        operator = _OPERATORS.get(type(test.ops[0]))
        if operator is None:
            return node
        left = _ast.NamedExpr(target=_ast.Name('_understory_left', _ast.Store()), value=test.left)
        right = _ast.NamedExpr(target=_ast.Name('_understory_right', _ast.Store()), value=test.comparators[0])
        message = _ast.Call(
            func=_ast.Name('_understory_explain', _ast.Load()),
            args=[_ast.Name('_understory_left', _ast.Load()), _ast.Constant(operator), _ast.Name('_understory_right', _ast.Load())],
            keywords=[],
        )
        rewritten = _ast.Assert(test=_ast.Compare(left=left, ops=test.ops, comparators=[right]), msg=message)
        return _ast.fix_missing_locations(_ast.copy_location(rewritten, node))


def _compile_tests(source):
    tree = _ast.parse(source, TESTS_FILE)
    try:
        tree = _AssertRewriter().visit(tree)
        return compile(tree, TESTS_FILE, 'exec')
    except Exception:
        # A rewrite the compiler rejects (a walrus inside a class body, say) must not cost
        # the author their tests: the plain source still runs, with plainer messages.
        return compile(source, TESTS_FILE, 'exec')


# ---- errors -------------------------------------------------------------------------


def _innermost(error, filename):
    """The last line of the traceback that is in the given file."""
    line = None
    for frame in _traceback.extract_tb(error.__traceback__):
        if frame.filename == filename:
            line = frame.lineno
    return line


def _source_line(error):
    frames = [f for f in _traceback.extract_tb(error.__traceback__) if f.filename in (CODE_FILE, TESTS_FILE)]
    if not frames:
        return ''
    return (frames[-1].line or '').strip()


def _failure_message(error):
    if isinstance(error, _Failure):
        return str(error)
    if type(error) is AssertionError:
        text = str(error)
        if text:
            return _clip(text, MAX_MESSAGE_LENGTH)
        where = _source_line(error)
        return _clip('Assertion failed' + (': ' + where if where else ''), MAX_MESSAGE_LENGTH)
    message = _describe_raised(error)
    line = _innermost(error, CODE_FILE)
    if line is not None:
        message += ' (line ' + str(line) + ')'
    return _clip(message, MAX_MESSAGE_LENGTH)


def _load_error(error, where):
    """A failure while compiling or loading, as the report's 'error'."""
    result = {'name': _clip(type(error).__name__, MAX_NAME_LENGTH)}
    if isinstance(error, SyntaxError):
        text = error.msg or 'invalid syntax'
        line = error.lineno if error.filename in (CODE_FILE, TESTS_FILE) else None
        in_tests = error.filename == TESTS_FILE
    else:
        text = str(error) or type(error).__name__
        code_line = _innermost(error, CODE_FILE)
        tests_line = _innermost(error, TESTS_FILE)
        in_tests = code_line is None and (where == 'tests' or tests_line is not None)
        line = code_line if code_line is not None else tests_line
    if line is not None and not in_tests:
        result['line'] = line
    elif line is not None:
        text += ' (tests, line ' + str(line) + ')'
    elif where == 'tests':
        text += ' (tests)'
    result['message'] = _clip(text, MAX_MESSAGE_LENGTH)
    return result


# ---- one run --------------------------------------------------------------------------


def _describe(run):
    class Describe:
        """'with describe("group"):' prefixes the names of the tests inside it."""

        def __init__(self, name, fn=None):
            self._name = str(name)
            if fn is not None:
                with self:
                    fn()

        def __enter__(self):
            run.groups.append(self._name)
            return self

        def __exit__(self, *exc):
            run.groups.pop()
            return False

    return Describe


def _test(run):
    def test(name, fn=None):
        """@test("name") on a function, or test("name", fn)."""
        if fn is not None:
            run.register(name, fn)
            return fn
        if callable(name) and not isinstance(name, str):
            run.register(getattr(name, '__name__', 'test'), name)
            return name

        def decorate(function):
            run.register(name, function)
            return function

        return decorate

    return test


def _run_one(name, fn):
    if not callable(fn):
        return {'name': name, 'passed': False, 'message': 'test() needs a function'}
    try:
        outcome = fn()
        if hasattr(outcome, '__await__'):
            outcome.close()
            return {'name': name, 'passed': False, 'message': 'Async tests are not supported. Make the test a plain function.'}
    except KeyboardInterrupt:
        raise
    except BaseException as error:
        # SystemExit too: exit() inside a test fails that test, not the run.
        return {'name': name, 'passed': False, 'message': _failure_message(error)}
    return {'name': name, 'passed': True}


async def _run_one_async(name, fn):
    if not callable(fn):
        return {'name': name, 'passed': False, 'message': 'test() needs a function'}
    try:
        outcome = fn()
        if hasattr(outcome, '__await__'):
            await outcome
    except KeyboardInterrupt:
        raise
    except BaseException as error:
        # CancelledError too: a test whose task was cancelled fails, the run goes on.
        return {'name': name, 'passed': False, 'message': _failure_message(error)}
    return {'name': name, 'passed': True}


def _no_asyncio_run(main, *args, **kwargs):
    if hasattr(main, 'close'):
        main.close()
    raise RuntimeError('asyncio.run() is not available here: the tests already run an event loop. Make the caller async and await the coroutine.')


def _guard_asyncio():
    """asyncio.run needs to block the thread until the loop is done, which Pyodide's
    browser event loop cannot do. It would fail with a message about stack switching;
    this one says what to write instead."""
    import asyncio
    original = asyncio.run
    asyncio.run = _no_asyncio_run

    def restore():
        asyncio.run = original

    return restore


def _cancel_leftovers():
    """Tasks the code started and never awaited must not run into the next run."""
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        mine = asyncio.current_task(loop)
        for task in asyncio.all_tasks(loop):
            if task is not mine:
                task.cancel()
    except Exception:
        pass


def _restore():
    _sys.stdout = _sys.__stdout__
    _sys.stderr = _sys.__stderr__
    for name in list(_sys.modules):
        if name in _BASE_MODULES:
            continue
        origin = getattr(_sys.modules.get(name), '__file__', None) or ''
        # Standard-library and built-in modules this run imported may stay: they hold no
        # learner state, and importing them again costs time. A module the code wrote to
        # disk and imported goes.
        if origin and not origin.startswith('/lib/'):
            del _sys.modules[name]
    _builtins.__dict__.clear()
    _builtins.__dict__.update(_BASE_BUILTINS)
    _sys.setrecursionlimit(_BASE_RECURSION)


def _report(run, status, error=None):
    run.flush_partial()
    report = {'status': status, 'tests': [], 'logs': list(run.logs)}
    if error is not None:
        report['error'] = error
    return report


def _listing_stand_in(name):
    if name.startswith('__'):
        raise AttributeError(name)
    return None


def _load(code, tests, host_log):
    """Compiles and runs the code and the tests, which registers the tests. Returns the
    run and, when loading failed, the report to return instead of running them."""
    code = str(code)
    tests = str(tests)
    only = None
    directive = _ONLY.match(tests)
    if directive:
        only = int(directive.group(1))
        tests = tests[directive.end():]

    run = _Run(host_log, only)
    module = _types.ModuleType('solution')
    namespace = module.__dict__
    namespace['__builtins__'] = _builtins
    namespace['test'] = _test(run)
    namespace['it'] = namespace['test']
    namespace['describe'] = _describe(run)
    namespace['expect'] = _Expect
    namespace['printed'] = run.printed
    namespace['_understory_explain'] = _explain
    if only == -1:
        # Listing runs with no learner code, so a name imported from solution is missing.
        # A stand-in lets "from solution import f" succeed; no test body runs while listing.
        namespace['__getattr__'] = _listing_stand_in
    _sys.modules['solution'] = module
    _sys.stdout = _Stream(run, 'out')
    _sys.stderr = _Stream(run, 'err')

    # The files exist only in memory. Without these entries a traceback has no source
    # line to show, and a failed plain assert could not quote itself.
    _linecache.cache[CODE_FILE] = (len(code), None, code.splitlines(True), CODE_FILE)
    _linecache.cache[TESTS_FILE] = (len(tests), None, tests.splitlines(True), TESTS_FILE)

    try:
        compiled_code = compile(code, CODE_FILE, 'exec')
    except SyntaxError as error:
        return run, _report(run, 'error', _load_error(error, 'code'))
    try:
        compiled_tests = _compile_tests(tests)
    except SyntaxError as error:
        return run, _report(run, 'error', _load_error(error, 'tests'))

    try:
        exec(compiled_code, namespace)
    except BaseException as error:
        return run, _report(run, 'error', _load_error(error, 'code'))
    try:
        exec(compiled_tests, namespace)
    except BaseException as error:
        return run, _report(run, 'error', _load_error(error, 'tests'))

    run.started = True
    return run, None


def _conclude(run, results):
    run.flush_partial()
    if not results:
        return _report(run, 'error', {'name': 'NoTests', 'message': 'No tests were registered.'})
    report = _report(run, 'passed' if all(r['passed'] for r in results) else 'failed')
    report['tests'] = results
    return report


def _execute(code, tests, host_log):
    run, failed = _load(code, tests, host_log)
    if failed is not None:
        return failed
    return _conclude(run, [_run_one(name, fn) for name, fn in run.registered])


async def _execute_async(code, tests, host_log):
    run, failed = _load(code, tests, host_log)
    if failed is not None:
        return failed
    results = []
    for name, fn in run.registered:
        results.append(await _run_one_async(name, fn))
    return _conclude(run, results)


def _harness_error(error):
    return {'status': 'error', 'tests': [], 'logs': [], 'error': {'name': 'HarnessError', 'message': _clip(_describe_raised(error), MAX_MESSAGE_LENGTH)}}


def _clean_up():
    _restore()
    _sys.modules.pop('solution', None)
    _linecache.cache.pop(CODE_FILE, None)
    _linecache.cache.pop(TESTS_FILE, None)
    _gc.collect()


def run(code, tests, host_log=None):
    unguard = _guard_asyncio()
    try:
        report = _execute(code, tests, host_log)
    except BaseException as error:
        report = _harness_error(error)
    finally:
        unguard()
        _clean_up()
    return _json.dumps(report)


async def run_async(code, tests, host_log=None):
    """run, for hosts that can await: a test may be an async function, and the host's
    event loop (Pyodide's webloop) drives it. Same report, same guarantees."""
    unguard = _guard_asyncio()
    try:
        report = await _execute_async(code, tests, host_log)
    except BaseException as error:
        report = _harness_error(error)
    finally:
        unguard()
        _cancel_leftovers()
        _clean_up()
    return _json.dumps(report)
