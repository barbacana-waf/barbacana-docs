---
hide:
  - toc
---

# WAF Protection Catalog

This is the canonical list of every protection Barbacana ships. It's the source you name in a route's [`disable:`](disable.md) or [`enable:`](enable.md) list, the values you'll see in `matched_protections` in the [audit log](../operations/audit-log.md), and the labels on `waf_*` Prometheus metrics.

!!! info "Generated from the binary"
    This page mirrors the output of `barbacana --catalog list`. Run that command against your installed binary to see exactly the catalog your build is enforcing — versions can drift if you don't upgrade in lockstep with these docs. `barbacana --catalog show <leaf-name>` prints a single leaf with its full rationale.

## How to read this page

Protections are organized in three levels:

- **L1 family** (`sql`, `php`, `cross-site-scripting`, `response-headers`, …) — the broadest disable. Turning off `sql` disables every SQL-related leaf.
- **L2 bucket** (`sql-injection`, `sql-data-leakage`, …) — a sub-class. Turning off `sql-injection` disables all SQLi leaves but keeps DB-error masking active.
- **Leaf** (`sql-injection-union-select`, …) — a single detection technique. The most specific name and the one you'll typically reach for to silence a false positive.

Both `disable:` and `enable:` accept any level. **More specific wins** — a leaf in `enable:` re-enables itself even if its L2 or L1 is in `disable:`, and the reverse for a leaf in `disable:`.

The **Default** column is the out-of-the-box state. `on` leaves run on every request unless you disable them; `off` leaves are opt-in via `enable:`. The **When to toggle** column gives the per-leaf rationale: for `on` leaves it's "why disable" (legitimate inputs that would FP), and for `off` leaves it's "why enable" (the extra coverage you opt into).

Off-by-default leaves fall into two groups:

- **Aggressive variants** of an on-by-default detector (e.g. `sql-injection-always-true`, `command-injection-english-words`) — they catch more attacks but produce false positives on natural-language input.
- **Response headers and HTTP-compliance checks that only make sense once tuned** (`response-headers-add-csp`, `response-headers-add-coop`, `http-compliance-accept-header`) — there's no value strict enough to matter that's safe to apply universally. See the [security headers reference](headers.md) for how to enable each one.


## sql

SQL-related protection: injection detection across all dialects plus per-vendor error-leakage detection.

**L1-level disable:** *Safe to disable when your app has no SQL backend at all (e.g., NoSQL-only API, no DB).*

### sql-injection

Server-side SQL injection detection.

**L2-level disable:** *Disable when you have a hosted DB-as-a-service that enforces queries server-side (Supabase, Hasura) and want to keep error masking active at L2 sql-data-leakage.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `sql-injection-generic` | on | CWE-89 | 942100, 942101 | Generic SQLi detection via the libinjection tokenizer — recognizes SQL fingerprints across many dialects without per-dialect regex. | Disable only if generic detection produces FPs that more specific leaves don't cover. Rare. |
| `sql-injection-generic-aggressive` | off | CWE-89 | 942330, 942370, 942380, 942390, 942400, 942470, 942480, 942490 | Broad-stroke SQLi probe patterns supplementing the tokenizer. Aggressive variant of sql-injection-generic; same detection family, higher FP cost. | Enable for paranoid SQLi coverage on hardened environments where the tokenizer's coverage isn't enough. FP rates are non-trivial on free-text inputs — pair with route-level accepts: [text] to scope it. |
| `sql-injection-operators` | on | CWE-89 | 942120, 942250, 942251 | Detects SQL operator keywords in suspicious positions — MATCH AGAINST, HAVING, LIKE followed by single-char tokens. | Disable if SQL operator names (AND, OR, LIKE, MATCH, HAVING) appear legitimately in free-text inputs — for example, search queries against a literature corpus. |
| `sql-injection-function-calls` | on | CWE-89 | 942150, 942151, 942152, 942410 | Detects SQL function names in suspicious positions (CHAR(), CONVERT(), SUBSTRING(), vendor-specific helpers) used to avoid quote literals. | Disable if SQL function names appear legitimately in inputs — for example, a SQL-reference docs site. |
| `sql-injection-system-schema-names` | on | CWE-89 | 942140 | Detects reserved schema/database names in inputs (information_schema, pg_catalog, mysql.user) — fingerprint of reconnaissance probes. | Disable if your app legitimately echoes DB/schema names — for example, a DBA dashboard or SQL documentation site. |
| `sql-injection-sql-comments` | on | CWE-89 | 942440, 942500 | MySQL inline-comment markers and comment-sequence detection — used to bypass keyword filters by commenting out tokens mid-query. | Disable if input legitimately contains /* */ or # comment markers — for example, a SQL editor or comment-rich free text. |
| `sql-injection-comments-in-json` | off | CWE-89 | 942200 | Aggressive variant — fires on , "key":"... patterns common in multi-key JSON bodies. Detects real MySQL comment/space-obfuscation but blocks ordinary JSON when active. | Enable only on routes that don't accept JSON bodies with multiple keys, or in detect-only mode. FP-prone on ordinary multi-key JSON. |
| `sql-injection-backticks` | on | CWE-89 | 942510, 942511 | Backtick bypass — `id`-style identifier quoting used to evade simple regex filters. | Disable if input legitimately contains backticks — for example, a Markdown editor or code-snippet tool. |
| `sql-injection-hex-encoded` | on | CWE-89 | 942450 | Hex-encoded SQLi payloads (0x5365…) — used to bypass quote/keyword filters by passing the payload as binary. | Disable if input legitimately contains long hex strings — for example, a binary-blob upload echoed back. |
| `sql-injection-string-concatenation` | on | CWE-89 | 942360, 942362 | Concatenated SQLi (CONCAT(), \|\|-style concatenation operators). | Disable if input legitimately contains SQL concat syntax — for example, a SQL playground. |
| `sql-injection-special-character-density` | off | CWE-89 | 942420, 942421, 942430, 942431, 942432, 942460 | Meta-character anomaly detection — flags args/cookies with abnormal density of SQL meta-characters. Strict thresholds at higher paranoia tiers. | Enable for paranoid coverage on locked-down routes where high density of SQL meta-characters in inputs is anomalous. |
| `sql-injection-time-based` | on | CWE-89 | 942160, 942170, 942280 | Time-based blind SQLi: sleep(), benchmark(), pg_sleep(), WAITFOR DELAY. The attacker can't see results so they exfiltrate via response timing. | Disable if upstream legitimately runs slow queries that mention timing functions — for example, a query-builder tool. |
| `sql-injection-always-true` | off | CWE-89 | 942130, 942131 | Boolean-based SQLi tautology detection (' OR '1'='1, 1=1, ' OR true). | Enable when broader tautology coverage matters and your inputs don't contain English or/and near digits or quotes. FP-prone on natural-language inputs. |
| `sql-injection-union-select` | on | CWE-89 | 942270, 942361 | Detects UNION SELECT and ALTER TABLE probe patterns. | Disable if input legitimately contains UNION/SELECT keywords — for example, a SQL-tutorial site. |
| `sql-injection-if-statements` | on | CWE-89 | 942230, 942300 | Conditional SQLi probes — IF(1=1, ...), CASE WHEN ..., comment-conditional injection. | Disable if input legitimately contains conditional SQL syntax — for example, a SQL editor preview. |
| `sql-injection-multiple-statements` | off | CWE-89 | 942210, 942310 | Chained SQLi — multiple statements separated by ;, used to append a DROP TABLE to a query. | Enable for hardened environments where multi-statement payloads (;-separated statements) warrant detection. |
| `sql-injection-query-closers` | on | CWE-89 | 942530 | Query-termination markers ('-- , ';--, ';#) — the classic SQLi closer that comments out the rest of the original query. | Disable if your app stores raw SQL queries — for example, a SQL playground or admin console. |
| `sql-injection-overflow-probes` | on | CWE-89 | 942220 | Detects integer-overflow probe values from skipfish-style fuzzers (2.2250738585072011e-308 and similar). | Rarely worth disabling. |
| `sql-injection-login-bypass` | on | CWE-89, CWE-287 | 942180, 942260, 942520, 942522, 942540 | Detects login-bypass SQLi patterns — ' UNION SELECT, split-query attacks, concat-bypass. | Disable if your auth flow legitimately accepts SQL-shaped strings. Extremely rare. |
| `sql-injection-quotes-in-text` | off | CWE-89, CWE-287 | 942521 | Aggressive variant — catches FP-prone auth-bypass shapes that fire on JSON values containing apostrophes. Detects real attacks but at significant FP cost. | Enable only on closed-corpus apps where input is API-shaped (no apostrophe-containing free text). FP-prone on names like "O'Brien" and product names like "d'or 1st". |
| `sql-injection-mssql-specific` | on | CWE-89 | 942190, 942240 | MSSQL-specific code execution patterns (xp_cmdshell, OPENROWSET, charset-switch DoS). | Disable if no MSSQL backend exists. |
| `sql-injection-stored-procedures` | on | CWE-89 | 942320, 942321, 942350 | Detects stored-procedure invocation patterns and MySQL UDF injection (CREATE FUNCTION lib_mysqludf_sys_exec). | Disable if you don't use MySQL/PostgreSQL stored procedures (or any at all). |
| `sql-injection-mongodb-operators` | on | CWE-943 | 942290 | MongoDB-style NoSQLi — {$ne: null}, {$gt: ""}, JSON-shaped operator injection. | Disable if no MongoDB backend exists or your driver uses parameterized queries. |
| `sql-injection-json-operators` | on | CWE-89 | 942550 | JSON-based SQLi — payloads exploiting JSON-aware query syntax in MySQL 5.7+ / PostgreSQL JSON operators. | Disable if your DB driver uses parameterized JSON arguments. |
| `sql-injection-scientific-notation` | on | CWE-89 | 942560 | Scientific-notation SQLi payloads exploiting MySQL's lax numeric parsing (1e0 parses to 1) to slip through filters that match decimal digits. | Rarely worth disabling. |

### sql-data-leakage

Per-vendor SQL error leakage detection in responses. Each leaf catches that vendor's distinctive error format.

**L2-level disable:** *Disable if your app already masks DB errors at the framework layer (no DB error ever reaches the response body).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `sql-data-leakage-mssql` | on | CWE-209 | 951220 | MSSQL error patterns (Unclosed quotation mark, Microsoft OLE DB Provider, [SQL Server]). | Disable if no MSSQL backend exists. |
| `sql-data-leakage-msaccess` | on | CWE-209 | 951110 | Microsoft Access error patterns (Microsoft JET Database Engine, Syntax error in query expression). | Disable if no MS Access backend exists. |
| `sql-data-leakage-oracle` | on | CWE-209 | 951120 | Oracle error patterns (ORA-, PL/SQL, Oracle Database). | Disable if no Oracle backend exists. |
| `sql-data-leakage-db2` | on | CWE-209 | 951130 | IBM DB2 error patterns (DB2 SQL error, SQLCODE=). | Disable if no DB2 backend exists. |
| `sql-data-leakage-informix` | on | CWE-209 | 951180 | Informix error patterns. | Disable if no Informix backend exists. |
| `sql-data-leakage-sybase` | on | CWE-209 | 951260 | Sybase error patterns. | Disable if no Sybase backend exists. |
| `sql-data-leakage-mysql` | on | CWE-209 | 951230 | MySQL error patterns (You have an error in your SQL syntax, mysql_fetch_array()). | Disable if no MySQL backend exists. |
| `sql-data-leakage-postgres` | on | CWE-209 | 951240 | PostgreSQL error patterns (ERROR: invalid input syntax, pg_query()). | Disable if no PostgreSQL backend exists. |
| `sql-data-leakage-sqlite` | on | CWE-209 | 951250 | SQLite error patterns (SQLite/JDBCDriver, near "...": syntax error). | Disable if no SQLite backend exists. |
| `sql-data-leakage-firebird` | on | CWE-209 | 951150 | Firebird error patterns. | Disable if no Firebird backend exists. |
| `sql-data-leakage-frontbase` | on | CWE-209 | 951160 | Frontbase error patterns. | Disable if no Frontbase backend exists. |
| `sql-data-leakage-hsqldb` | on | CWE-209 | 951170 | HSQLDB error patterns. | Disable if no HSQLDB backend exists. |
| `sql-data-leakage-ingres` | on | CWE-209 | 951190 | Ingres error patterns. | Disable if no Ingres backend exists. |
| `sql-data-leakage-interbase` | on | CWE-209 | 951200 | Interbase error patterns. | Disable if no Interbase backend exists. |
| `sql-data-leakage-maxdb` | on | CWE-209 | 951210 | MaxDB error patterns. | Disable if no MaxDB backend exists. |
| `sql-data-leakage-emc` | on | CWE-209 | 951140 | EMC SQL error patterns. | Disable if no EMC DB backend exists. |

## php

PHP-specific attack and leakage detection.

**L1-level disable:** *Safe to disable when your app stack has no PHP anywhere.*

### php-injection

Server-side PHP code-injection patterns — open tags, function-name calls, stream wrappers, object deserialization, variable abuse.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `php-injection-open-tags` | on | CWE-94 | 933100, 933190 | Detects literal <?php, <?=, or ?> markers in inputs — the basic shape of an attempt to inject inline PHP for server-side evaluation. | Disable if your app legitimately accepts PHP source as content — for example, a PHP-snippet paste service or a CMS storing raw PHP. |
| `php-injection-script-upload` | on | CWE-434 | 933110, 933111, 933220 | Catches uploads whose filename or body indicates a PHP script. Also catches PHP session-file uploads — the classic "upload your shell" attack against insecure upload endpoints. | Disable if your app legitimately accepts uploaded .php/.phtml files — for example, a code-hosting service. |
| `php-injection-config-directives` | on | CWE-94 | 933120 | Detects php.ini-style directive names (allow_url_include, auto_prepend_file, etc.) in request arguments. | Disable if your app legitimately accepts php.ini-style configuration as input. Very rare. |
| `php-injection-superglobal-names` | on | CWE-94 | 933130, 933131, 933135 | Catches $_GET, $_POST, $GLOBALS, etc. being passed as input — used in attacks that try to override or read PHP-internal variables. | Disable if input legitimately includes PHP superglobal names as values — for example, a security-research tool or PHP documentation site. |
| `php-injection-stream-wrappers` | on | CWE-94, CWE-98 | 933140, 933200 | Detects PHP stream wrapper schemes (php://, phar://, expect://, data://) in inputs — used to bypass include/fopen filters and trigger code execution or arbitrary file reads. Includes phar:// deserialization patterns. | Disable if you legitimately reflect URI strings containing php://, data://, etc. into responses for documentation purposes. |
| `php-injection-dangerous-functions` | on | CWE-94, CWE-95 | 933150, 933160 | Detects high-risk PHP function names (eval, assert, system, exec, passthru, shell_exec, popen, proc_open) in request arguments. Strong RCE signal. | Disable if your app legitimately exposes PHP function names as data. Very rare; likely a docs site for PHP. |
| `php-injection-suspicious-functions-aggressive` | off | CWE-94 | 933151, 933152, 933153, 933161 | Medium-risk and low-value PHP function-name patterns (base64_decode, gzinflate, str_rot13, file-system helpers, low-value identifiers) in inputs. Aggressive variant of php-injection-dangerous-functions. | Enable in conjunction with php-injection-dangerous-functions if your app has no PHP backend and you want broader coverage. FP rate higher because function names overlap common English words; low-value patterns folded into the same aggressive variant. |
| `php-injection-serialized-objects` | on | CWE-502 | 933170 | Detects PHP-serialized object literals (O:5:"Class":3:{...}) in request inputs — the trigger pattern for unserialize-based RCE chains (PHPGGC). | Disable if your app legitimately accepts serialized PHP objects as input — for example, a debugger interface. |
| `php-injection-indirect-function-calls` | on | CWE-94 | 933180, 933210, 933211 | Catches indirect-call syntax $foo($bar) and variable-named function references — used in obfuscated PHP RCE payloads to evade static-name detectors. | Disable only if your app deliberately exposes PHP variable-function call syntax as data. |

### php-data-leakage

PHP info / source disclosure detection in responses.

**L2-level disable:** *Disable if your app already masks PHP errors at the framework layer (custom error pages, sentry-style sink).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `php-data-leakage-version-info` | on | CWE-200 | 953100, 953101 | Detects PHP information-disclosure markers in responses (PHP Version, Loaded Configuration File, Server API, etc.) — the classic phpinfo() output. | Disable if your app intentionally exposes a phpinfo()-style endpoint. Debug builds only — never in production. |
| `php-data-leakage-source-code` | on | CWE-540 | 953110, 953120 | Detects PHP source-code patterns in response bodies — fires when a misconfigured server returns .php files as text instead of executing them. | Disable if your app legitimately echoes PHP source — for example, a code-hosting service or paste tool. |

## java

Java-specific attack and leakage detection.

**L1-level disable:** *Safe to disable when your app stack has no Java anywhere.*

### java-injection

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `java-injection-class-and-method-names` | on | CWE-94 | 944100, 944130, 944250, 944260 | Detects suspicious Java class names and method-invocation patterns in inputs (java.lang.Runtime, ProcessBuilder, URLClassLoader, getRuntime().exec()) — typical in OGNL/EL/Spring-style RCE payloads. | Disable if your app legitimately exposes Java class names or method-invocation patterns as data — for example, a JVM diagnostic tool. |
| `java-injection-struts2-runtime-exec` | on | CWE-78, CWE-94 | 944110 | Specifically targets the Struts2 process-spawn pattern from CVE-2017-9805 (XML payload triggers Runtime.exec). | Disable when you've ruled out Struts2 entirely. |
| `java-injection-serialized-objects` | on | CWE-502 | 944120, 944200, 944210, 944240 | Detects Java serialized-object magic bytes (AC ED 00 05) and base64-encoded variants — the trigger for ysoserial-style deserialization gadget chains (CVE-2015-4852 family). | Disable if your app legitimately accepts serialized Java objects — for example, a debugging or replication endpoint. |
| `java-injection-script-upload` | on | CWE-434 | 944140 | Catches JSP/JSPX script uploads — the classic "upload your webshell" attack against Tomcat-based stacks. | Disable if your app legitimately accepts uploaded .jsp/.jspx files — for example, an enterprise CMS for JSP authoring. |
| `java-injection-log4shell` | on | CWE-917 | 944150, 944151, 944152 | Log4Shell detection — matches ${jndi:ldap://...} / ${jndi:rmi://...} and obfuscated variants (${${::-j}ndi:...}). | Disable when you've fully migrated off vulnerable Log4j versions and want to reduce overhead. |
| `java-injection-base64-encoded-keywords` | off | CWE-94 | 944300 | Detects base64-encoded text whose decode hits a Java-suspicious keyword (java.lang., Runtime, ProcessBuilder). | Enable for hardened environments where suspicious base64 strings in inputs warrant detection. |

### java-data-leakage

Java response-side error/stack-trace leakage.

**L2-level disable:** *Disable if your app already masks Java errors at the framework layer (custom error pages, Spring's ResponseEntityExceptionHandler).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `java-data-leakage-stack-trace` | on | CWE-209 | 952110 | Detects Java stack-trace markers in responses (java.lang.NullPointerException, at com.example…) — fires when an unhandled exception leaks to clients. | Disable if your app already masks Java errors at the framework layer — for example, custom error pages or Spring's ResponseEntityExceptionHandler. |

## ruby

Ruby-specific attack and leakage detection.

**L1-level disable:** *Safe to disable when your app stack has no Ruby anywhere.*

### ruby-injection

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `ruby-injection-system-calls` | on | CWE-78, CWE-94 | 934150 | Detects Ruby code-injection patterns in inputs — system(), eval(), IO.popen, ERB-style injection, backticks. | Disable if no Ruby runtime is involved at any layer. |

### ruby-data-leakage

Ruby info / source disclosure detection in responses.

**L2-level disable:** *Disable if your app already masks Ruby errors at the framework layer.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `ruby-data-leakage-version-info` | on | CWE-200 | 956100 | Detects Ruby information-disclosure markers in responses (Ruby on Rails, RubyGems, version banners). | Disable if responses legitimately mention Ruby version banners. |
| `ruby-data-leakage-source-code` | off | CWE-540 | 956110 | Detects Ruby source-code patterns in response bodies — def/end blocks, class X < Y, require '...'. | Enable to detect raw Ruby source leakage when misconfigured servers serve .rb files as text. Off by default because patterns can match Ruby-discussion forum posts. |

## perl

Perl-specific attack detection.

**L1-level disable:** *Safe to disable when no Perl backend exists.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `perl-injection-system-calls` | on | CWE-78, CWE-94 | 934140 | Detects Perl injection patterns in inputs — system, exec, qx{}, backticks, open() with shell-mode. | Disable if no Perl backend exists. |

## iis

Microsoft IIS-specific response-side disclosure detection. The family currently has only leakage rules; the L2 bucket is named iis-data-leakage for symmetry with other language families and to leave room for future injection-side rules.

**L1-level disable:** *Safe to disable when you don't run IIS anywhere.*

### iis-data-leakage

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `iis-data-leakage-install-paths` | on | CWE-200, CWE-540 | 954100, 954101 | Detects IIS install paths in responses (C:\inetpub\wwwroot\, C:\Windows\System32\inetsrv\). | Disable if responses legitimately reference IIS paths. |
| `iis-data-leakage-availability-errors` | on | CWE-209 | 954110 | Detects IIS application-availability error messages (HTTP Error 500.0 - Internal Server Error). | Disable for non-IIS stacks. |
| `iis-data-leakage-version-headers` | on | CWE-200 | 954120, 954130 | Detects IIS information disclosure (X-AspNet-Version-style version banners in responses). | Disable for non-IIS stacks. |

## javascript

JavaScript-runtime attack detection — covers Node.js, Bun, Deno, browser JS, anywhere eval happens.

**L1-level disable:** *Safe to disable when your app is sandboxed/serverless with no JS runtime, or front-end-only.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `javascript-injection-eval` | on | CWE-94, CWE-95 | 934100, 934101 | Detects JS code-injection patterns: eval(, new Function(, module.exports=, child_process, process.binding, require(...). | Disable if your app legitimately accepts JS source as input — for example, a JS sandbox or playground. |
| `javascript-infinite-loops` | on | CWE-400, CWE-1333 | 934160 | Detects JS infinite-loop ReDoS patterns: while(!0), while(1), while(true) constructs that always evaluate true. Universal across JS engines. | Rarely worth disabling. |
| `javascript-prototype-pollution` | on | CWE-1321 | 934130 | Detects __proto__ and constructor.prototype in inputs — JS prototype-chain manipulation. Universal across Node, Bun, Deno, browser. | Disable if your app legitimately accepts __proto__-shaped JSON — for example, some legacy serialization formats. |

## cross-site-scripting

XSS detection across all contexts and evasion techniques.

**L1-level disable:** *Safe to disable when your service is API-only with no HTML rendering anywhere.*

### cross-site-scripting-html-context

XSS vectors in HTML output context — tags, event handlers, attributes, broader injection markers.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `cross-site-scripting-script-tags` | on | CWE-79 | 941100, 941101, 941110 | Detects <script> tags in inputs — the classic XSS vector. If reflected unescaped in HTML output, the script executes in the victim's browser. | Common FP shape — fires on rich-text editors, Markdown previews, comment fields that accept HTML, and any route that reflects user-supplied HTML. Disable at the route level via accepts: [html] (preferred) or globally via disable: (last resort). |
| `cross-site-scripting-event-handlers` | on | CWE-79 | 941120 | Detects on*= event-handler attributes (onload, onerror, onclick) — the second-most-common XSS vector after <script>. | Common FP shape — same pattern as cross-site-scripting-script-tags. Most rich-text editors strip event handlers via sanitizer (DOMPurify, sanitize-html), but if yours doesn't or if you store raw HTML, this will FP. |
| `cross-site-scripting-html-attributes` | on | CWE-79 | 941130, 941150, 941170 | Detects attribute-injection patterns including disallowed-attribute lists (formaction, srcdoc, data-URI in href). | Moderate FP risk on apps that accept HTML attributes in inputs (markup-aware editors, custom markdown extensions). |
| `cross-site-scripting-html-injection-markers` | on | CWE-79 | 941160, 941320 | NoScript XSS InjectionChecker patterns — broader HTML-injection markers than <script> alone, catching what specific-leaf detectors miss. | Disable if input legitimately contains broad HTML-tag-shaped content not caught by the more specific leaves. |
| `cross-site-scripting-suspicious-keywords` | on | CWE-79 | 941180, 941181 | Node-Validator-style denylist keywords — a rolling list of XSS-related identifier strings. | Disable on free-text inputs with high keyword overlap — for example, HTML/JS-tutorial sites. |

### cross-site-scripting-javascript-context

XSS vectors in JS output context — javascript: URIs, JS keywords, AngularJS template injection.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `cross-site-scripting-javascript-urls` | on | CWE-79 | 941140 | Detects javascript: URI-scheme attribute values — classic XSS vector via <a href="javascript:...">. | Disable if input legitimately contains javascript: URLs — for example, a URL-archival site. |
| `cross-site-scripting-javascript-keywords` | on | CWE-79 | 941210, 941370, 941390, 941400 | Detects JS globals, methods, and function-without-parens shapes (alert, document.cookie, eval). | Disable if input legitimately contains JS keywords — for example, a JS-discussion site or tutorial platform. |
| `cross-site-scripting-angular-templates` | off | CWE-79, CWE-1336 | 941380 | AngularJS client-side template injection ({{constructor.constructor('alert(1)')()}}-style). | Enable on routes that render Angular templates server-side. |

### cross-site-scripting-encoding-tricks

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `cross-site-scripting-encoding-evasion` | on | CWE-79, CWE-176 | 941310, 941350 | US-ASCII malformed encoding and UTF-7 encoding XSS evasion — used to bypass naive output encoding. | Rarely worth disabling. |
| `cross-site-scripting-jsfuck-obfuscation` | on | CWE-79 | 941360 | Detects JSFuck / Hieroglyphy / [][[]]-style heavily-obfuscated JS — used to evade keyword filters by writing JS using only []()!+. | Rarely worth disabling. |

### cross-site-scripting-legacy-browsers

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `cross-site-scripting-internet-explorer` | on | CWE-79 | 941190, 941200, 941220, 941230, 941240, 941250, 941260, 941270, 941280, 941290, 941300, 941330, 941340 | Internet Explorer-specific XSS filter rules covering IE-only XSS quirks (mXSS, tag-handler tricks). 13 CRS rules in a single bucket. | Disable if you have no IE users in your audience. Most modern stacks. |

## command-injection

Remote command execution detection across platforms.

**L1-level disable:** *Disable carefully when your app is fully sandboxed (serverless functions, WASM, language-only runtime) with no shell access possible.*

### command-injection-unix

Unix shell command-injection family. The largest sub-bucket — most diverse attack surface in CRS.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `command-injection-unix-commands` | on | CWE-77, CWE-78 | 932220, 932230, 932231, 932232, 932235, 932239, 932240, 932250, 932260, 932340, 932350 | Direct Unix command injection — detects command names like ls, cat, rm, wget, curl, nc followed by typical-arg patterns. | Moderate FP risk on free-text inputs (search queries, comments, support tickets) where command names appear as English words used in technical context. The base rule requires command-name + typical-arg-pattern, which keeps FPs lower than the aggressive variant — but content sites that reflect technical text will still see hits. Disable for free-text-heavy routes. |
| `command-injection-english-words` | off | CWE-77, CWE-78 | 932236 | Aggressive variant of command-injection-unix-commands. Fires on common English words like "echo", "curl", "exec", "bash", "nc", "java" followed by any token — high FP rate on free-text inputs. | Enable only on closed-corpus apps where command-name false positives are tolerable. FP-prone on English words. |
| `command-injection-shell-substitution` | on | CWE-78 | 932130, 932131, 932160, 932161, 932237, 932238, 932270, 932271 | Unix shell expressions — $(cmd), backticks, ${VAR} substitution patterns used to inline command output into other contexts. | Disable if input legitimately contains shell-expression syntax — for example, an admin-tooling input. |
| `command-injection-shell-aliases` | on | CWE-78 | 932175 | Shell alias invocation patterns — used to evade keyword filters by aliasing (alias l='ls';l /etc). | Rarely worth disabling. |
| `command-injection-shell-history` | on | CWE-78 | 932330, 932331 | Shell history-substitution patterns (!!, !N, !cmd) — used in interactive shells to re-run prior commands. | Rarely worth disabling. |
| `command-injection-brace-expansion` | on | CWE-78 | 932280, 932281 | Brace-expansion patterns ({a,b,c}, {1..10}) — used to compactly enumerate options in shell commands and to bypass simple keyword filters. | Disable if input legitimately contains brace-expansion syntax. |
| `command-injection-shell-wildcards` | off | CWE-78 | 932190 | Wildcard bypass technique — uses ?/* to construct command names without typing them literally (/???/?? instead of /bin/sh). | Enable for hardened environments where ? and * characters in inputs are unexpected — for example, an API that accepts only alphanumeric IDs. |
| `command-injection-evasion-tricks` | off | CWE-78 | 932200, 932205, 932206, 932207 | RCE bypass techniques — IFS abuse, encoding tricks, command splitting via env-var injection. | Enable for paranoid coverage of advanced bypass techniques. |
| `command-injection-fork-bomb` | on | CWE-78, CWE-400 | 932390 | Detects classic shell fork-bomb pattern :(){ :\|:& };:. | Rarely worth disabling. |
| `command-injection-shellshock` | on | CWE-78 | 932170, 932171 | Shellshock detection (CVE-2014-6271) — function-export environment variable pattern that triggers bash-shell command execution. | Disable when you've fully patched out vulnerable bash versions and want to reduce overhead. |

### command-injection-windows

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `command-injection-windows-cmd` | on | CWE-77, CWE-78 | 932140, 932370, 932371, 932380 | Windows cmd.exe command injection — dir, del, type, for /f, findstr patterns. | Disable if no Windows backend exists. |
| `command-injection-powershell` | on | CWE-78 | 932120, 932125 | PowerShell command and alias injection — Invoke-Expression, Get-Content, encoded-command patterns. | Disable if no PowerShell-capable backend exists. |

### command-injection-embedded-shells

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `command-injection-sqlite-shell` | off | CWE-78 | 932210 | SQLite-via-shell command execution patterns. SQLite's .shell and .system directives can trigger OS command exec. | Enable when SQLite shell access is a concern. |

## local-file-access

Local File Inclusion / path-traversal protection. Catches attempts to read files outside the intended scope.

**L1-level disable:** *Disable carefully when your app doesn't read filesystem based on user input — for example, a fully containerized service with no filesystem access from request inputs. Rare.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `local-file-access-dot-dot-paths` | on | CWE-22, CWE-23 | 930100, 930110 | Detects classic path-traversal sequences (../, ..\, /.../, encoded variants). | Disable if your app legitimately accepts ../-containing inputs — for example, a path-rewriting tool. |
| `local-file-access-os-files` | on | CWE-22, CWE-200 | 930120, 930121 | Detects attempts to access OS system files (/etc/passwd, /proc/self/environ, C:\Windows\system32\drivers\etc\hosts). | Moderate FP risk — fires on any app that legitimately displays file paths (file managers, IDE-in-browser, log viewers, build dashboards, dev tooling, security-research tools). The rule fires on inputs and responses; the response-side detection is where most FPs land. Disable if your app legitimately renders or references OS filesystem paths. |
| `local-file-access-dotfiles` | on | CWE-22, CWE-538 | 930130 | Detects attempts to access restricted dotfiles (.htaccess, .git/, .svn/, .env). | Disable if your app legitimately serves these — for example, a Git-hosting platform serving .htaccess from repos. |
| `local-file-access-ai-tool-files` | on | CWE-22, CWE-538 | 930140 | Detects AI-coding-assistant artifact paths (.continue/, .claude/, .aider*, .cursor/). New CRS v4 family targeting agent leakage. | Disable if your app legitimately exposes AI-tooling artifact paths. |

## remote-file-fetch

Remote File Inclusion protection. Attacks that fetch attacker-controlled URLs and execute their content.

**L1-level disable:** *Safe to disable when your app can't include remote files (no eval-from-URL pattern).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `remote-file-fetch-ip-urls` | on | CWE-98 | 931100 | Detects URLs with literal IP addresses in parameter values — fingerprint of RFI probes. | Rarely worth disabling. |
| `remote-file-fetch-suspicious-param-names` | on | CWE-98 | 931110 | Detects URL payloads in parameters with known-vulnerable names (include=, template=, page=, path=). | Rarely worth disabling. |
| `remote-file-fetch-truncation-trick` | on | CWE-98 | 931120 | Detects URL payloads ending in ? — used to truncate filename-suffix appending in vulnerable PHP includes. | Rarely worth disabling. |
| `remote-file-fetch-external-urls` | off | CWE-98, CWE-918 | 931130, 931131 | Detects off-domain URL references in parameter values. | Enable to add off-domain URL detection in inputs. Off by default because legitimate inputs frequently contain external URLs. |

## outbound-request-forgery

Server-Side Request Forgery protection. Detects attempts to coerce the server into making outbound requests on the attacker's behalf.

**L1-level disable:** *Safe to disable when your app can't make outbound requests (firewall-isolated, no DNS, no fetch APIs).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `outbound-request-forgery-cloud-metadata` | on | CWE-918 | 934110 | Detects cloud-provider metadata URLs in parameter values (169.254.169.254, metadata.google.internal) — fingerprint of cloud-credential-theft attacks. | Rarely worth disabling. |
| `outbound-request-forgery-internal-addresses` | on | CWE-918 | 934120, 934190 | Detects scheme-less or IP-literal URLs in parameters that target internal addresses (localhost, 127.0.0.1, RFC1918 ranges). | Disable if your app legitimately accepts internal-hostname URLs as input. |

## file-upload

Multipart-form-data attack detection (CRS) and validation (native).

**L1-level disable:** *Safe to disable when your service has no file uploads or multipart handling.*

### file-upload-attacks

CRS-backed multipart bypass / abuse detection.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `file-upload-attacks-charset-trick` | on | CWE-444 | 922100 | Detects global _charset_ field definitions in multipart bodies — used to bypass content filters. | Rarely worth disabling. |
| `file-upload-attacks-content-type-trick` | on | CWE-444 | 922110, 922140, 922150 | Illegal CT charset parameters in multipart headers. | Rarely worth disabling. |
| `file-upload-attacks-deprecated-encoding` | on | CWE-444 | 922120 | Detects deprecated Content-Transfer-Encoding in multipart parts (RFC 7578 deprecated this in 2015). | Rarely worth disabling. |
| `file-upload-attacks-header-tricks` | on | CWE-444 | 922130 | Invalid characters in multipart-section headers — fingerprint of parser-bypass attempts. | Rarely worth disabling. |

### file-upload-limits

Native multipart-upload validation rules and content-shape limits.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `file-upload-limits-max-file-count` | on | CWE-770 | native | Per-route file-count cap enforced by the native multipart validator. | Disable when uploads can legitimately contain many files in a single request. |
| `file-upload-limits-max-file-size` | on | CWE-400, CWE-434, CWE-770 | native, 920400 | Per-file size cap. Both native multipart validator and CRS rule 920400 contribute; one toggle controls both. | Disable for routes with large legitimate uploads. |
| `file-upload-limits-max-total-size` | on | CWE-400, CWE-770 | 920410 | Per-request total upload-size cap — sum of all file parts in a single multipart request. Independent of per-file cap; a route may allow large individual files but cap total request size, or vice versa. | Disable for routes that legitimately accept large multi-file requests in aggregate (e.g., archive uploads). |
| `file-upload-limits-allowed-types` | on | CWE-434 | native | MIME-type allow-list per route — rejects file parts whose declared CT isn't in the route's accept.upload_types. | Disable to allow any MIME type. Rare; usually a security mistake. |
| `file-upload-limits-double-extension` | on | CWE-434 | native | Detects file.php.jpg-style double-extension uploads — classic shell-upload trick on mod_rewrite-misconfigured Apache. | Disable if your app legitimately accepts files with composite extensions. |
| `file-upload-limits-executable` | on | CWE-434 | 932180 | Detects upload of executable file types (.exe, .dll, .so, .elf) — restricted file-upload check. Belongs with the other content-shape limits in this bucket. | Disable if your app legitimately accepts executable file uploads — for example, a malware-analysis service. |

## http-compliance

HTTP RFC-compliance enforcement. Catches malformed requests, unusual headers, character-encoding tricks, and policy violations.

**L1-level disable:** *Disable carefully when your upstream is non-RFC-strict (e.g., a legacy proxy that mangles framing). Increases attack surface; usually wrong.*

### http-compliance-request-framing

Request-line validation, body presence on GET/HEAD, content-length consistency, smuggling fingerprints.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http-compliance-malformed-request-line` | on | CWE-444 | 920100 | Detects malformed HTTP request lines — GET / HTTP/1.1\n without proper CRLF, missing version, etc. | Disable for upstreams that emit non-RFC request lines. |
| `http-compliance-multipart-boundaries` | on | CWE-444 | 920120, 920121 | Detects multipart/form-data bypass attempts — non-standard boundary syntax used to confuse parsers. | Moderate FP risk — some real-world multipart implementations (older Python requests, mobile SDKs, embedded HTTP clients) emit non-strict boundaries. Disable if your client library does. |
| `http-compliance-content-length` | on | CWE-444 | 920160 | Catches non-numeric Content-Length header values. | Rarely worth disabling. |
| `http-compliance-get-with-body` | on | CWE-444 | 920170, 920171 | Detects GET or HEAD requests carrying a body or Transfer-Encoding header — RFC says they shouldn't. | Disable if your API allows GET requests with bodies — for example, some search APIs do this. |
| `http-compliance-post-without-length` | on | CWE-444 | 920180 | Detects POST requests without Content-Length and without Transfer-Encoding — ambiguous body length. | Rarely worth disabling. |
| `http-compliance-conflicting-length` | on | CWE-444 | 920181 | Detects requests carrying both Content-Length and Transfer-Encoding — the classic request-smuggling fingerprint. | Rarely worth disabling. |
| `http-compliance-http-version` | on | CWE-444 | 920430 | Detects HTTP versions outside the route's allow-list. | Disable if your route accepts HTTP/0.9 or some non-standard version. |
| `http-compliance-method-override-param` | off | CWE-444 | native, 920650 | Detects HTTP-method override attempts via _method parameter. | Enable to flag _method parameter overrides. Used by some frameworks (Rails) but also by attackers to bypass method-policy filters. |
| `http-compliance-uri-fragments` | on | CWE-444 | 920610 | Detects raw #fragment in the URI sent to the server — should normally be client-side only. | Disable for SPAs that intentionally pass #fragment to the server. |

### http-compliance-headers

Header presence and shape validation — Host, Accept, User-Agent, Content-Type, Accept-Encoding, restricted headers, Range, Connection.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http-compliance-host-header` | on | CWE-20 | 920280, 920290, 920350 | Catches missing/empty Host header and IP-literal Host values. | Disable for legacy clients that don't send Host, or for routes that receive health-check probes or load-balancer probes connecting by IP (the rule flags IP-literal Host values, which are routine in those flows). |
| `http-compliance-accept-header` | off | CWE-20 | 920300, 920310, 920311, 920600 | Empty/missing Accept and illegal Accept-charset parameter detection. | Enable if your app is browser-only and your clients always send Accept. Off by default because many JSON APIs are called from curl, internal service-to-service code, mobile SDKs, and SDK-generated clients that legitimately omit Accept. The signal is "automation," not "attack." |
| `http-compliance-user-agent-header` | off | CWE-20 | 920320, 920330 | Missing or empty User-Agent header detection. | Enable if your app expects browser traffic only. Off by default because empty User-Agent is the normal case for curl without -A, internal service-to-service calls, embedded device firmware, and historical Go http.Client. No real attack class is gated by "must have a User-Agent header." |
| `http-compliance-content-type-header` | on | CWE-20 | 920340, 920470, 920480, 920530, 920620, 920640 | CT header policy — illegal CT values, multiple CTs, CT charset validity, CT missing on bodied requests. | Rarely worth disabling. |
| `http-compliance-accept-encoding` | on | CWE-20 | 920520, 920521 | Accept-Encoding length cap and illegal-value detection. | Disable for clients that send long or unusual Accept-Encoding values. |
| `http-compliance-restricted-headers` | on | CWE-20 | 920450, 920451, 920490, 920510 | Restricted-header denylist — flags headers like X-Up-Devcap-Post-Charset and Cache-Control variants that aren't in the allow-list. | Disable if you legitimately send headers in the restricted list — for example, Cache-Control with non-standard directives. |
| `http-compliance-range-header` | on | CWE-400 | 920190, 920200, 920201, 920202, 920660 | Range header anomalies — invalid last-byte values, too many byte-ranges, obsolete Request-Range header. | Disable if upstream serves PDFs/videos with many byte-ranges. |
| `http-compliance-connection-header` | on | CWE-444 | 920210 | Detects multiple/conflicting Connection header values. | Rarely worth disabling. |

### http-compliance-character-encoding

Character-encoding abuse — URL encoding, UTF-8 abuse, null bytes, invalid characters.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http-compliance-double-url-encoding` | off | CWE-177 | native, 920230, 920240, 920460 | Multiple URL encoding detection (%2520 instead of %20, etc.). Native and CRS detection backends both contribute. | Enable on routes where multi-URL-encoded inputs warrant detection. Off by default because legitimate inputs sometimes need double-encoding. |
| `http-compliance-utf8-tricks` | on | CWE-176 | native, 920250, 920260, 920540 | UTF-8 abuse — overlong sequences, full/half-width abuse, surrogate-pair tricks used to bypass naive validators. | Disable for routes serving Unicode-heavy content. |
| `http-compliance-null-bytes` | on | CWE-158 | native, 920270 | Catches literal null bytes (\x00) in request inputs — used to truncate strings in C-string-aware downstream code. | Rarely worth disabling. |
| `http-compliance-non-printable-characters` | off | CWE-176 | 920271, 920272, 920273, 920274, 920275 | Non-printable / non-ASCII / strict-set character detection — increasingly strict at higher paranoia tiers. | Enable on locked-down routes where ASCII-only inputs are expected. |

### http-compliance-allowed-shapes

What the route allows (content-type, file extension) and what it explicitly forbids (backup-file probes).

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http-compliance-allowed-content-types` | on | CWE-20 | 920420 | Catches Content-Type values not in the route's allow-list. | Disable when content-type allow-list is enforced at the app layer. |
| `http-compliance-blocked-extensions` | on | CWE-538 | 920440 | Catches URL file extensions in the restricted list (.bak, .git, .ini). | Disable for static-content routes serving many file types. |
| `http-compliance-backup-file-probes` | on | CWE-530 | 920500 | Backup-file-extension probe detection (.bak, .swp, .old, .~) — fingerprint of recon attempts. | Rarely worth disabling. |

## http-attacks

Explicit protocol-level attacks — smuggling, response splitting, header injection, parameter pollution.

**L1-level disable:** *Risky — disable only when your upstream provably handles these attacks itself or operates behind a managed CDN that does. Most leaves should rarely be off; prefer disabling individual leaves over the whole family.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http-attacks-request-smuggling` | on | CWE-444 | native, 921110 | HTTP request smuggling detection — conflicting framing headers used to desync front-end and back-end parsers. | Rarely worth disabling — smuggling attacks are dangerous and the FP rate is low. Native and CRS detection both contribute. |
| `http-attacks-response-splitting` | on | CWE-113 | 921120, 921130 | HTTP response-splitting attack — CR/LF injected into header values to inject extra headers or a second response. | Rarely worth disabling. |
| `http-attacks-header-crlf-injection` | on | CWE-93, CWE-113 | native, 921140, 921150, 921151, 921160, 921190 | CR/LF injection into headers via payload, including header-name detection. | Rarely worth disabling. Native and CRS detection both contribute. |
| `http-attacks-duplicate-parameters` | off | CWE-235 | 921170, 921180, 921210, 921220 | HTTP Parameter Pollution — duplicate parameter names and array-notation tricks. | Enable for hardened environments where duplicate parameters warrant detection. Off by default because legitimate apps often have intentional duplicates. |
| `http-attacks-range-dos` | off | CWE-400 | 921230 | Range header attack patterns (Apache CVE-2011-3192-style requests with many overlapping byte ranges that exhaust memory). | Enable when you've ruled out legitimate large-byte-range requests. |
| `http-attacks-apache-mod-proxy` | on | CWE-444 | 921240 | Detects Apache mod_proxy abuse patterns. | Disable if you don't run Apache mod_proxy upstream. |
| `http-attacks-rfc2109-cookies` | on | CWE-565 | 921250 | Detects obsolete RFC 2109 ("Cookie V1") syntax — should never appear in modern requests. | Rarely worth disabling. |
| `http-attacks-dangerous-content-types` | on | CWE-434 | 921421, 921422 | Detects dangerous content types in MIME structure — application/x-shockwave-flash declared outside the MIME container, etc. | Disable if your app legitimately uses unusual content-type values in body parts. |

## ldap-injection

LDAP injection patterns. Promoted to its own L1 from the original protocol-attack-ldap-injection — it's its own attack class, not an HTTP attack.

**L1-level disable:** *Safe to disable when no LDAP backend exists.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `ldap-injection` | on | CWE-90 | 921200 | LDAP injection patterns in inputs — *)(uid=*), *))%00, etc. | Disable if no LDAP backend exists. |

## mail-protocol-injection

SMTP / IMAP / POP3 protocol-command injection in mail-handling endpoints. Promoted to its own L1 from the original rce-mail-protocol-injection.

**L1-level disable:** *Safe to disable when your app doesn't process or forward mail headers.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `mail-protocol-injection` | on | CWE-77, CWE-93 | 932300, 932301, 932310, 932311, 932320, 932321 | SMTP / IMAP / POP3 protocol-command injection patterns — \r\nMAIL FROM, \nDATA, etc. injected into email-handling inputs. | Disable if your app doesn't process or forward mail headers. |

## template-injection

Server-side template injection (SSTI) detection.

**L1-level disable:** *Off by default; enable on routes that render server-side templates with user-controlled data.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `template-injection` | off | CWE-94, CWE-1336 | 934180 | Detects SSTI payloads — {{7*7}}, ${{, <%= template expressions appearing in inputs. Technology-agnostic across template engines. | Enable if your app renders server-side templates (Jinja, ERB, Twig, FreeMarker, Velocity, Handlebars) with user-controlled data anywhere in the template. FP risk on routes that legitimately reflect template-syntax-shaped strings. |

## data-uri-abuse

data: URI scheme abuse detection.

**L1-level disable:** *Safe to disable when no data: URI processing happens in the app (most common case).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `data-uri-abuse` | on | CWE-79, CWE-918 | 934170 | Detects data: URI scheme abuse — used in XSS-via-PHP-context, SSRF via fetch APIs, and SVG-injection chains. | Disable if input legitimately contains data: URIs — for example, a base64-image upload service. |

## server-data-leakage

Tech-agnostic server-error / info disclosure detection.

**L1-level disable:** *Safe to disable when custom error pages already mask all server errors.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `server-data-leakage-directory-listing` | on | CWE-548 | 950130 | Detects HTML directory listing patterns in responses (Index of /, <title>Directory Listing</title>). | Disable if responses legitimately render directory listings — for example, a file-browser app. |
| `server-data-leakage-cgi-source` | on | CWE-540 | 950140 | Detects CGI source-code leakage in responses (#!/usr/bin/perl, cgi-bin paths exposed). | Disable for routes that intentionally serve CGI scripts. Rare. |
| `server-data-leakage-aspnet-errors` | on | CWE-209 | 950150 | Detects ASP.NET exception leakage in responses (<title>Server Error</title>, [NullReferenceException]). | Disable if you've already configured custom error pages in ASP.NET. |
| `server-data-leakage-5xx-bodies` | off | CWE-209 | 950100 | Detects 5xx-status responses for masking. | Enable to mask 5xx response bodies via response inspection. Off by default because masking-by-status-code is already provided by response-error-masking. |

## web-shell-detection

Known web-shell signature detection in responses.

**L1-level disable:** *Safe to disable for read-only static sites with no upload paths.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `web-shell-detection` | on | CWE-94, CWE-912 | 955100, 955110, 955120, 955130, 955140, 955150, 955160, 955170, 955180, 955190, 955200, 955210, 955220, 955230, 955240, 955250, 955260, 955270, 955280, 955290, 955300, 955310, 955320, 955330, 955340, 955350, 955400 | Catches 27 known web-shell signatures in response bodies — r57, WSO, b4tm4n, Mini Shell, Ashiyane, ASP-shells, etc. Single bucket because operators rarely want fine-grained control over which web-shell families are detected. | Disable if you legitimately serve files that match web-shell signatures — for example, a malware-research repository. |

## scanner-detection

Known security-scanner User-Agent detection.

**L1-level disable:** *Safe to disable when operating behind a CDN that already filters scanner User-Agents.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `scanner-detection-user-agent` | on | CWE-200 | 913100 | Detects User-Agent strings of known vulnerability scanners (sqlmap, nikto, w3af, masscan, nuclei, etc.). | Disable for routes that serve security tooling itself. |

## session-fixation

Session-fixation attack detection.

**L1-level disable:** *Safe to disable when your service is API-only using bearer tokens with no cookie-based sessions.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `session-fixation-cookie-injection` | on | CWE-384 | 943100 | Detects Set-Cookie values being injected via HTML — an attempt to plant a session cookie via an XSS-style payload. | Rarely worth disabling. |
| `session-fixation-external-referer` | on | CWE-384 | 943110 | Detects session-ID parameters with off-domain Referer headers — fingerprint of an attacker linking to your app with a pre-set session ID. | Disable if cross-domain session-handoff is intentional — for example, a federated-login flow. |
| `session-fixation-missing-referer` | on | CWE-384 | 943120 | Detects session-ID parameters on requests with no Referer at all — same attack pattern as session-fixation-external-referer, slightly different shape. | Disable for routes that legitimately receive direct session-ID-bearing links — for example, a magic-link auth flow. |

## http2

Native HTTP/2 frame-flood and DoS guards.

**L1-level disable:** *Safe to disable when HTTP/2 is not exposed (HTTP/1.1 only at the listener).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `http2-frame-flood` | on | CWE-400 | native | Native HTTP/2 CONTINUATION-frame flood protection (CVE-2024-27316 family). | Rarely worth disabling. |
| `http2-header-bomb` | on | CWE-400, CWE-409 | native | HPACK decompression bomb protection — caps the expansion ratio of HPACK-encoded headers. | Rarely worth disabling. |
| `http2-max-streams` | on | CWE-400, CWE-770 | native | Per-connection HTTP/2 stream-count cap. | Disable for backends needing many concurrent HTTP/2 streams per connection. |

## request-validation

Native request-shape rules — body/url/header size, allowed methods, required headers, slow-client detection.

**L1-level disable:** *Risky — disable only when operating in detect-only mode or with a different size-cap layer (CDN, ingress controller) that demonstrably handles these checks.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `request-validation-max-body-size` | on | CWE-400, CWE-770 | native | Maximum request-body size; returns 413 on violation. | Disable for routes with intentionally large bodies. |
| `request-validation-max-url-length` | on | CWE-400 | native | Maximum URL length; returns 414 on violation. | Disable for routes with very long URLs — for example, legacy GET-with-many-params APIs. |
| `request-validation-max-header-size` | on | CWE-400 | native | Total header bytes cap; returns 431 on violation. | Disable for clients sending large auth tokens in headers. Rare. |
| `request-validation-max-header-count` | on | CWE-400 | native | Maximum header count; returns 431 on violation. | Disable for clients sending many headers. |
| `request-validation-argument-limits` | on | CWE-400 | 920360, 920370, 920380, 920390 | Argument name/value length, count, and total-size caps. | Disable for routes accepting genuinely long arg names/values — for example, file metadata APIs. |
| `request-validation-allowed-methods` | on | CWE-749 | native | Method allow-list per route from accept.methods; returns 405 on violation. | Disable to accept any HTTP method. Usually a security mistake. |
| `request-validation-require-host-header` | on | CWE-20 | native | Host header required; returns 400 on violation. | Disable for legacy clients without Host header (HTTP/1.0 only). |
| `request-validation-require-content-type` | on | CWE-20 | native | Content-Type required for POST/PUT/PATCH; returns 415 on violation. | Disable for routes that accept bodies without content-type. Rare. |
| `request-validation-slow-clients` | on | CWE-400 | native | Slow-request DoS protection — drops connections that send headers/body too slowly (Slowloris). | Disable for environments with slow legitimate clients — for example, low-bandwidth IoT. |

## json-parsing

Native JSON body parser limits.

**L1-level disable:** *Safe to disable when no JSON body parsing happens in this service.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `json-parsing-max-depth` | on | CWE-400, CWE-674 | native | JSON nesting-depth cap — defends against parser stack overflow. | Disable for legitimate deeply-nested JSON — for example, GraphQL queries with many sub-selections. |
| `json-parsing-max-keys` | on | CWE-400, CWE-407 | native | Maximum JSON keys per object — defends against hash-collision DoS. | Disable for JSON bodies with many keys per object. |

## xml-parsing

Native XML body parser limits.

**L1-level disable:** *Safe to disable when no XML body parsing happens in this service.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `xml-parsing-max-depth` | on | CWE-400, CWE-674 | native | XML nesting-depth cap — defends against parser stack overflow. | Disable for deeply-nested XML schemas. Rare. |
| `xml-parsing-entity-expansion` | on | CWE-776 | native | Billion-laughs / entity-expansion protection — caps the number of <!ENTITY>/<!DOCTYPE> directives in a request body to defend against entity-expansion DoS. XXE-proper (external SYSTEM/PUBLIC entities) is mitigated separately by Go's encoding/xml not resolving external entities; this rule covers expansion-ratio attacks only. | Rarely worth disabling — billion-laughs is a real threat. |

## resource-limits

Native resource-limit protections.

**L1-level disable:** *Risky — disable only on internal services with trusted clients to maximize throughput, with awareness that ReDoS, zip-bombs, and memory exhaustion attacks become more effective.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `resource-limits-max-inspection-size` | on | CWE-400 | native | Maximum bytes inspected per request — beyond this size, the body is forwarded without inspection. | Disable for very-large-body routes where partial inspection isn't acceptable. Better to turn off WAF entirely on those routes. |
| `resource-limits-max-memory` | on | CWE-400, CWE-770 | native | In-flight memory budget cap — protects against memory exhaustion under load. | Rarely worth disabling. |
| `resource-limits-decompression-ratio` | on | CWE-409 | native | Decompression-ratio cap on gzip/deflate request bodies — defends against zip-bomb. | Rarely worth disabling. |
| `resource-limits-evaluation-timeout` | on | CWE-400, CWE-1333 | native | Per-request CRS-engine timeout — protects against ReDoS-driven CRS evaluation latency. | Rarely worth disabling. |

## openapi

Native OpenAPI-3 request validation against the route's openapi.spec.

**L1-level disable:** *Safe to disable when no OpenAPI spec is maintained for this route.*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `openapi-path-not-in-spec` | on | CWE-20 | native | Path not in OpenAPI spec; returns 404 on violation. | Disable for routes intentionally accepting paths not in the spec. |
| `openapi-method-not-in-spec` | on | CWE-749 | native | Method not in spec for the matched path; returns 405 on violation. | Disable for routes accepting methods not in the spec. |
| `openapi-parameter-mismatch` | on | CWE-20 | native | Parameter shape mismatch (type, required, format); returns 422 on violation. | Disable for routes with optional query params not declared in the spec. |
| `openapi-body-mismatch` | on | CWE-20 | native | Request body shape mismatch against the spec; returns 422 on violation. | Disable for routes whose bodies don't match the spec strictly. |
| `openapi-content-type-not-in-spec` | on | CWE-20 | native | Content-Type not declared in the spec for the path/method; returns 415 on violation. | Disable for routes that accept content types not in the spec. |

## response-headers

Response-header manipulation — injection of security headers and stripping of leakage headers.

**L1-level disable:** *Disable carefully when you don't manipulate response headers (handled upstream).*

### response-headers-add

Inject security-related response headers. Default policy: headers with safe browser-side defaults that don't visibly break apps stay on. Headers that require per-app tuning to avoid breaking legitimate functionality default off.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `response-headers-add-hsts` | on | CWE-319 | native | Inject Strict-Transport-Security header. Low FP risk — almost no app legitimately depends on HTTPS being optional. | Disable for non-HTTPS deployments. |
| `response-headers-add-csp` | off | CWE-79, CWE-1021 | native | Inject Content-Security-Policy header using the value from route.csp.policy. Primary mitigation against XSS that bypasses output encoding. | Off by default because no CSP value strict enough to matter works across apps without per-app tuning — inline scripts, third-party origins, frame ancestors all vary. Enable in conjunction with a route-level csp.policy config field (the directive string the WAF should inject). Without csp.policy set, enabling this leaf is a no-op. Keep off if CSP is configured at the framework layer (Rails, Django middleware). |
| `response-headers-add-frame-options` | on | CWE-1021 | native | Inject X-Frame-Options: SAMEORIGIN to prevent clickjacking. | Default value is SAMEORIGIN, which is safe for almost every app. Disable for routes intentionally embeddable in iframes — for example, oEmbed providers, payment widgets. |
| `response-headers-add-nosniff` | on | CWE-79, CWE-430 | native | Inject X-Content-Type-Options: nosniff to prevent MIME-sniffing attacks. | Rarely worth disabling — no app legitimately depends on browser MIME sniffing. |
| `response-headers-add-referrer-policy` | on | CWE-200 | native | Inject Referrer-Policy header. | Default value is strict-origin-when-cross-origin (the modern browser default); injecting it explicitly is harmless. Disable if your analytics depends on full-URL referrers. |
| `response-headers-add-dns-prefetch` | on | CWE-200 | native | Inject X-DNS-Prefetch-Control header. Minor performance/privacy hint; low FP either way. | Disable to allow DNS prefetching. |
| `response-headers-add-coop` | off | CWE-1021 | native | Inject Cross-Origin-Opener-Policy header. | Enable on routes that need cross-origin window isolation. Off by default because injecting COOP without per-app review breaks OAuth popup flows, embedded windows, and window.opener-using integrations. There's no useful "safe default" value — anything strict enough to matter breaks something. |
| `response-headers-add-coep` | off | CWE-1021 | native | Inject Cross-Origin-Embedder-Policy header. | Enable on routes that need full cross-origin isolation (e.g., for SharedArrayBuffer). Off by default because COEP requires every cross-origin resource the page loads to opt in via CORP or CORS — most apps would break immediately. |
| `response-headers-add-corp` | off | CWE-1021 | native | Inject Cross-Origin-Resource-Policy header. | Enable on routes serving resources that should not be embeddable cross-origin (sensitive APIs, private images). Off by default because the safe default value (cross-origin) provides no protection, and stricter values block legitimate cross-origin embedding. |
| `response-headers-add-permissions-policy` | off | CWE-1021 | native | Inject Permissions-Policy header (formerly Feature-Policy). | Enable when you have a tuned policy. Off by default because any policy strict enough to matter blocks legitimate features (camera, microphone, geolocation, USB, payment) and breaks apps that use them — there's no useful one-size-fits-all default. |
| `response-headers-add-cache-control` | off | CWE-525 | native | Inject Cache-Control directives appropriate for the route's sensitivity class. | Enable for sensitivity-class-aware cache control on routes you've classified. Off by default because cache policy is route-specific (a static asset, a personalized page, and a sensitive API need three different policies) and is best set at the app or CDN layer. |

### response-headers-remove

Strip identifying headers from upstream responses.

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `response-headers-remove-server` | on | CWE-200 | native | Strip Server header from upstream responses. | Disable if upstream-identification is intentional — for example, debug environments. |
| `response-headers-remove-powered-by` | on | CWE-200 | native | Strip X-Powered-By header. | Rarely worth disabling. |
| `response-headers-remove-aspnet-version` | on | CWE-200 | native | Strip X-AspNet-Version and X-AspNetMvc-Version. | Rarely worth disabling. |
| `response-headers-remove-generator` | on | CWE-200 | native | Strip X-Generator header. | Disable if your CMS depends on the X-Generator header. |
| `response-headers-remove-drupal` | on | CWE-200 | native | Strip Drupal-specific headers (X-Drupal-Cache, X-Generator: Drupal …). | Rarely worth disabling. |
| `response-headers-remove-varnish` | on | CWE-200 | native | Strip Varnish-related headers. | Rarely worth disabling. |
| `response-headers-remove-via` | on | CWE-200 | native | Strip Via header. | Disable if Via is needed for proxy debugging. |
| `response-headers-remove-runtime` | on | CWE-200 | native | Strip X-Runtime header (Rails). | Rarely worth disabling. |
| `response-headers-remove-debug` | on | CWE-200, CWE-489 | native | Strip debug headers (X-Debug-*, X-Trace-*). | Rarely worth disabling. |
| `response-headers-remove-backend-server` | on | CWE-200 | native | Strip X-Backend-Server header. | Rarely worth disabling. |
| `response-headers-remove-version` | on | CWE-200 | native | Strip X-Version header. | Rarely worth disabling. |

## response-inspection

Native response-body inspection. Open-redirect detection and OpenAPI response-shape validation.

**L1-level disable:** *Disable carefully when you don't inspect or modify response bodies (treats responses as opaque).*

| ID | Default | CWE | Rule IDs | What it does | When to toggle |
|---|---|---|---|---|---|
| `response-inspection-open-redirects` | on | CWE-601 | native | Detects Location headers pointing off-domain — fingerprint of open-redirect vulnerabilities. | Disable for routes that intentionally redirect off-domain — for example, auth providers. |
| `response-inspection-openapi-validation` | on | CWE-20 | native | Validates response shape against the route's OpenAPI spec. | Disable when responses don't always conform to the OpenAPI spec strictly. |

