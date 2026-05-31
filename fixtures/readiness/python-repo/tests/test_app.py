from src.app import ready


def test_ready() -> None:
    assert ready() is True
