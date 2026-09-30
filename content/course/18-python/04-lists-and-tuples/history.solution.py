def trim_history(history, keep):
    system, *messages = history
    return [system] + messages[-keep:]
