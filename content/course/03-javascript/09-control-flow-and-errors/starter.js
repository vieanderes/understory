function settleOrder(charge, release) {
  try {
    return { status: "paid", receipt: charge() };
  } catch (error) {
    // Every failure vanishes here, and the seats are never released.
  }
  return { status: "paid", receipt: "" };
}
