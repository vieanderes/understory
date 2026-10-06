def judge_report(items):
    missed = [i["id"] for i in items if i["human"] == "fail" and i["judge"] == "pass"]
    false_alarms = [i["id"] for i in items if i["human"] == "pass" and i["judge"] == "fail"]
    fails = sum(1 for i in items if i["human"] == "fail")
    # With no failures to catch, there's no rate to report, not a perfect one.
    fail_recall = None if fails == 0 else (fails - len(missed)) / fails
    return {"missed": missed, "false_alarms": false_alarms, "fail_recall": fail_recall}
