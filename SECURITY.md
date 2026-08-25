# Security

Report a vulnerability privately through GitHub: **Security → Report a
vulnerability** on this repository. That opens a private advisory only the
maintainer can read. Please do not open a public issue for it.

Say what you found, what it lets someone do, and how to reproduce it. A
proof-of-concept is welcome and a working exploit is not required.

You will get an answer. This is one person's project, so expect days rather
than hours.

## What is in scope

Anything that lets a program do something the language says it cannot: escape
the arena, read memory it does not own, or reach the machine from a sandbox
that promised it could not. A crash on malformed input is a bug worth
reporting; a crash you caused by editing the compiler is not.
