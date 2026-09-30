from solution import Ticket, read_ticket


@test("a good reply becomes a checked Ticket")
def _():
    ticket = read_ticket('{"category": "refund", "urgent": true}')
    expect(ticket).to_be_instance_of(Ticket)
    assert ticket.category == "refund"
    assert ticket.urgent is True


@test('"false" in quotes becomes False, not a true string')
def _():
    ticket = read_ticket('{"category": "delivery", "urgent": "false"}')
    assert ticket.urgent is False


@test("a category outside the list gives None")
def _():
    expect(read_ticket('{"category": "Refund", "urgent": true}')).to_be_none()


@test("a chatty reply that isn't JSON gives None")
def _():
    reply = 'Sure! Here it is: {"category": "other", "urgent": false}'
    expect(read_ticket(reply)).to_be_none()


@test("the log names the missing field")
def _():
    expect(read_ticket('{"category": "refund"}')).to_be_none()
    expect("\n".join(printed())).to_contain("urgent")
