# Transcription endpoints

resonand does not transcribe. When you ask, it sends a recording to a transcription endpoint you
configure — a server on your own network or a hosted service — and keeps what comes back as timed
segments. This page says which endpoints work and how to find out for yourself.

## There is no list of supported models

And there cannot be one. "OpenAI-compatible" describes the shape of a URL, not what a given model
returns, and vendors disagree even within their own product line. The unit of compatibility is
**an endpoint plus a model**.

## The criterion

An endpoint plus a model works when it:

1. accepts `POST {base_url}/audio/transcriptions` as multipart, with the audio in a `file` field
   and a base URL ending in `/v1`;
2. accepts `response_format=verbose_json`;
3. answers with a JSON object holding a `segments` array, each segment with `start`, `end` and
   `text`.

A bearer key, a `language` parameter and a speaker per segment are used when present and never
required. Timestamps in seconds or in milliseconds are both accepted. An answer without segments
is refused outright: resonand stores timed segments, never a block of prose.

## Check before you trust

Both of these answer before a single recording of yours is sent, and the admin panel runs the same
check:

```sh
resonand check-transcription                  # sends a generated tone; none of your audio moves
resonand check-transcription --audio x.m4a    # also reports timestamp granularity and speaker labels
```

## Verified with this code

| Endpoint | Model | |
|---|---|---|
| faster-whisper server ([speaches](https://github.com/speaches-ai/speaches)) on the local network | `BSC-LT/faster-whisper-large-v3-ca-punctuated-3370h` | Reference deployment |
| Groq, hosted | `whisper-large-v3` | Verified |

## Known not to work

- **OpenAI `gpt-4o-transcribe` and `gpt-4o-mini-transcribe`.** They return text without segments,
  so they fail — even though they are what the vendor's own documentation recommends. This is the
  most common trap: the endpoint is right, the model is not.
- **Azure OpenAI.** It uses a different URL shape (`/openai/deployments/<name>/…?api-version=`)
  instead of `/v1`, and does not work as it stands.

## Expected to work, not yet verified here

OpenAI `whisper-1`, any faster-whisper or CTranslate2 model behind an OpenAI-compatible server,
whisper.cpp's server in OpenAI mode, and Groq's other Whisper models. Run the check before relying
on any of them.

## Not supported today

Engines with their own APIs — Deepgram, AssemblyAI, ElevenLabs, Speechmatics. Each needs an
adapter of its own beside the OpenAI-compatible one; that work is in [`ROADMAP.md`](../ROADMAP.md).
