.PHONY: install serve build deploy clean

install:
	uv sync

serve:
	uv run mkdocs serve

build:
	uv run mkdocs build --strict

deploy:
	uv run mkdocs gh-deploy --force

clean:
	rm -rf site/
