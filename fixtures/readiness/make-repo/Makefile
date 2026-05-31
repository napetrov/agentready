.PHONY: build test lint typecheck

build:
	cc -o app main.c

test:
	./run-tests.sh

lint:
	clang-format --dry-run --Werror main.c

typecheck:
	cc -fsyntax-only main.c
