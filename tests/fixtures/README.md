# Synthetic video input

`sample.webm` is the existing locally generated test pattern and440Hz tone:
3seconds,160×120 at10fps, VP8 video and Vorbis audio. It contains no user media.
The original fixture was made with ffmpeg testsrc/sine, libvpx/libvorbis and one
encoder thread. Its22,298bytes and SHA256 are asserted by the rendered tests:
`e08c61a95e5360c254bab3689fb5530a852337029b384d5cc617f92a64e26066`.

This tracked test input replaces dependence on a developer's ignored scratch
folder. Tests need no ffmpeg installation and do not regenerate the fixture.
