import re


def is_heading(line: str) -> bool:
    text = line.strip()

    if not text:
        return False

    if len(text) > 120:
        return False

    if re.match(r"^#{1,6}\s+\S+", text):
        return True

    if re.match(r"^\d+(\.\d+)*[\.\)]?\s+\S+", text):
        return True

    if text.isupper() and 2 <= len(text.split()) <= 12:
        return True

    if text.endswith(":") and len(text.split()) <= 10:
        return True

    return False