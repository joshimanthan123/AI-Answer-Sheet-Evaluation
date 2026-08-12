"""
Test helpers that build fake Azure AI Document Intelligence result objects.

These mimic the shape the ``azure-ai-documentintelligence`` SDK returns from
``poller.result()`` closely enough for AzureProvider's mapping logic:

    AnalyzeResult
      .pages -> [ page ]
        page.lines -> [ line ]           line.content, line.spans[].offset/.length
        page.words -> [ word ]           word.content, word.confidence, word.span.offset/.length

No real SDK or network is used anywhere. Word ``offset`` values are used to
associate words with the line span that contains them (mirroring how the real
SDK links words to lines via character spans).
"""
from types import SimpleNamespace
from typing import List, Tuple


def _span(offset: int, length: int) -> SimpleNamespace:
    return SimpleNamespace(offset=offset, length=length)


def make_word(content: str, confidence: float, offset: int, length: int) -> SimpleNamespace:
    return SimpleNamespace(content=content, confidence=confidence, span=_span(offset, length))


def make_line(content: str, offset: int, length: int) -> SimpleNamespace:
    return SimpleNamespace(content=content, spans=[_span(offset, length)])


def make_page(lines_spec: List[Tuple[str, List[Tuple[str, float, int, int]]]]) -> SimpleNamespace:
    """
    Build a single fake page.

    lines_spec: list of (line_text, [ (word_text, confidence, offset, length), ... ]).
    The line span is derived to cover all of its words' character offsets.
    """
    lines = []
    words = []
    for line_text, word_specs in lines_spec:
        if word_specs:
            start = min(o for _, _, o, _ in word_specs)
            end = max(o + ln for _, _, o, ln in word_specs)
            line_offset, line_length = start, end - start
        else:
            line_offset, line_length = 0, len(line_text)
        lines.append(make_line(line_text, line_offset, line_length))
        for w_text, conf, off, ln in word_specs:
            words.append(make_word(w_text, conf, off, ln))
    return SimpleNamespace(lines=lines, words=words)


def make_analyze_result(
    lines_spec: List[Tuple[str, List[Tuple[str, float, int, int]]]]
) -> SimpleNamespace:
    """Build a fake AnalyzeResult with a single page containing the given lines."""
    return SimpleNamespace(pages=[make_page(lines_spec)])


def make_poller(result) -> SimpleNamespace:
    """Build a fake long-running-operation poller whose .result() returns result."""
    return SimpleNamespace(result=lambda: result)
