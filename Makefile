BIN = ./node_modules/.bin
MOCHA_OPTS = --timeout 2000
REPORTER = spec
TEST_FILES = test/*.js
TEST_INTEGRATION_FILES = test/integration/*.js
S3_STOIC=s3cmd -c ~/.s3cmd/.stoic
S3_NPM_REPO=s3://npm-repo

lint:
	jshint lib/* test/* --config .jshintrc

test: lint
	./node_modules/.bin/mocha \
		$(MOCHA_OPTS) \
		--reporter $(REPORTER) \
		$(TEST)

test-integration: lint
	./node_modules/.bin/mocha \
		$(MOCHA_OPTS) \
		--reporter $(REPORTER) \
		$(TEST_INTEGRATION_FILES)

test-ci:
	$(MAKE) -k test MOCHA_OPTS="$(MOCHA_OPTS) --watch --growl" REPORTER="min"

lib-cov:
	[ -d "lib-cov" ] && rm -rf lib-cov || true
	$(BIN)/istanbul instrument --output lib-cov --no-compact --variable global.__coverage__ lib

test-cov: lib-cov
	@LOG4JS_COV=1 $(MAKE) test "REPORTER=mocha-istanbul" ISTANBUL_REPORTERS=text-summary,html

clean:
	[ -d "lib-cov" ] && rm -rf lib-cov || true
	[ -d "reports" ] && rm -rf reports || true
	[ -d "build" ] && rm -rf build || true

install-local:
	@npm install
	@npm link ../mapperjs || true

deploy:
	@npm pack
	$(S3_STOIC) put *.tgz  $(S3_NPM_REPO)
	rm *.tgz

.PHONY: test
