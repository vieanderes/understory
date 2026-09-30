import numpy as np


def pass_rate(scores, threshold):
    return float((scores >= threshold).mean())
