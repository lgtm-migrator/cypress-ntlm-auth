<!-- markdownlint-disable MD024 -->
<!-- markdownlint-disable MD033 -->

# cypress-ntlm-auth

NTLM authentication plugin for [Cypress](https://www.cypress.io/)

If you want to perform end-to-end testing against deployed sites that require Windows Authentication, and you want to use [Cypress](https://www.cypress.io/), you will find that Cypress does not support Windows Authentication. Windows Authentication is quite widely used in corporate intranets. This plugin bridges the gap by providing NTLM authentication (and Negotiate when using SSO) for Cypress in a streamlined manner.

[![version](https://img.shields.io/npm/v/cypress-ntlm-auth.svg)](https://www.npmjs.com/package/cypress-ntlm-auth)
[![downloads](https://img.shields.io/npm/dt/cypress-ntlm-auth.svg)](https://www.npmjs.com/package/cypress-ntlm-auth)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/bjowes/cypress-ntlm-auth.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/bjowes/cypress-ntlm-auth/context:javascript)
[![MIT License](https://img.shields.io/github/license/bjowes/cypress-ntlm-auth.svg)](https://github.com/bjowes/cypress-ntlm-auth/blob/master/LICENSE)

[Changelog](https://github.com/bjowes/cypress-ntlm-auth/blob/master/CHANGELOG.md)

_Never heard of Cypress?_

Read the intro at [their site](https://www.cypress.io/) and find out if it is the thing for you. (_spoiler - it is!_)

_Want to use NTLM or Negotiate authentication for something else?_

Parts of this library should be readily reusable, the ntlm-proxy is application agnostic and should be usable with Selenium or other solutions - you'll have to provide the streamlining into your application yourself though.

## BREAKING CHANGES from 3.0.0

The launcher has been refactored to start the ntlm-proxy internally (not in a separate shell as before). This simplifies the setup a bit and makes it possible to run multiple instances of cypress with this plugin in parallel!
To migrate to this version:

- Remove any code referencing cypress-ntlm-auth in the `cypress/plugins/index.js` file
- The scripts in `package.json` are no longer strictly needed, you can launch both the proxy and cypress with the single command `npx cypress-ntlm open`. Using scripts for different test setups can still be useful, so if you want to keep the scripts you need to modify them. Remove any references to `ntlm-proxy` and `ntlm-proxy-exit` - keep only the `cypress-ntlm` part.

## Install

```shell
npm install --save-dev cypress-ntlm-auth
```

The `--save-dev` flag stores cypress-ntlm-auth as a development dependency, which is suitable for a testing utility.

## Configure

Follow these steps to configure Cypress to utilize this plugin:

### Commands

In the file `cypress/support/index.js` add this line

```javascript
import "cypress-ntlm-auth/dist/commands";
```

## Startup

### npx cypress-ntlm open

The most convenient way to start Cypress with NTLM authentication is

```shell
npx cypress-ntlm open
```

This starts the ntlm-proxy and runs cypress in headed mode (like `cypress open`). After Cypress exits, the ntlm-proxy is terminated. `cypress-ntlm open` accepts the same command line arguments that `cypress open` does.

### npx cypress-ntlm run

```shell
npx cypress-ntlm run
```

This starts the ntlm-proxy and runs cypress in headless mode (like `cypress run`), suitable for CI. After Cypress exits, the ntlm-proxy is terminated.`cypress-ntlm run` accepts the same command line arguments that `cypress run` does.

## Advanced startup

### ntlm-proxy

This binary is available in the `node_modules/.bin` folder. Use it if you need to start the ntlm-proxy manually. To use specific ports you can set `CYPRESS_NTLM_AUTH_API` and `CYPRESS_NTLM_AUTH_PROXY` environment variables.

#### Example - Mac and Linux

```shell
# Start NTLM proxy
npx ntlm-proxy

# Start NTLM proxy as a background process
npx ntlm-proxy &

# Start NTLM proxy with debug logging to console
DEBUG=cypress:plugin:ntlm-auth npx ntlm-proxy
```

#### Example - Windows

```shell
# Start NTLM proxy
npx ntlm-proxy

# Start NTLM proxy as a background process, close window when ntlm-proxy terminates
start /min \"ntlm-proxy\" cmd /c npx ntlm-proxy

# Start NTLM proxy with debug logging to console
set DEBUG=cypress:plugin:ntlm-auth
npx ntlm-proxy
```

### ntlm-proxy-exit

This binary is available in the `node_modules/.bin` folder. Use it to send an exit command to a ntlm-proxy running in the background. `CYPRESS_NTLM_AUTH_API` environment variable must be set for this command.

#### Example - Mac and Linux

```shell
# Terminate NTLM proxy
npx ntlm-proxy-exit

# Stop NTLM proxy with debug logging to console
DEBUG=cypress:plugin:ntlm-auth npx ntlm-proxy-exit
```

#### Example - Windows

```shell
# Terminate NTLM proxy
npx ntlm-proxy-exit

# Stop NTLM proxy with debug logging to console
set DEBUG=cypress:plugin:ntlm-auth
npx ntlm-proxy-exit
```

### cypress-ntlm

This binary is available in the `node_modules/.bin` folder. Use it to start Cypress with NTLM authentication configured. Depending on environment variables, this command will use an existing ntlm-proxy or start its own. It is easier to just let it handle its own ntlm-proxy, but if you need to use a specific instance, you need to set the environment variable:

- `CYPRESS_NTLM_AUTH_API` - set this to the url the ntlm-proxy config API is listening to (example: http://localhost:54368)

When this is set, cypress-ntlm will check if it can reach the proxy and see that it is alive. Otherwise the cypress-ntlm command will fail.

#### Example - Mac, Linux and Windows

```shell
# Start Cypress with NTLM authentication
npx cypress-ntlm open
```

## Upstream proxy

If your network environment enforces proxy usage for internet access (quite likely given that you are using NTLM) and the host you are testing uses resources on the internet (e.g. loading bootstrap or jQuery from a CDN), you need to make the ntlm-proxy aware of the internet proxy. This is done by setting the (standardized) environment variables below before starting the ntlm-proxy (with either the `ntlm-proxy` binary or the `cypress-ntlm` binary):

- `HTTP_PROXY` - The URL to the proxy for accessing external HTTP/HTTPS resources. Example: `http://proxy.acme.com:8080`
- `HTTPS_PROXY` - (optional) The URL to the proxy for accessing external HTTPS resources. Overrides `HTTP_PROXY` for HTTPS resources. Example: `http://proxy.acme.com:8080`
- `NO_PROXY` - A comma separated list of internal hosts to exclude from proxying. Add the host you are testing, and other local network resources used from the browser when accessing the host you are testing. Note that hosts that are located on the internet (not your intranet) must not be added, they should pass through the upstream proxy.

Include only the hostname (or IP), not the protocol or port. Wildcards are supported. Example: \*.acme.com

Since the plugin requires traffic to localhost to be excluded from the corporate proxy, the plugin adds `localhost` and `127.0.0.1` to the `NO_PROXY` setting automatically unless they are already there. To disable this behavior (if you require an additional custom proxy), add `<-loopback>` to `NO_PROXY`.

Note that these environment variables must be specified as uppercase. Lowercase variants will be ignored.

## Usage

### cy.ntlm(ntlmHosts, username, password, [domain, [workstation]])

The ntlm command is used to configure host/user mappings. After this command, all network communication from cypress to the specified hosts is monitored by the ntlm-proxy. If the server sends an authentication challenge, the ntlm-proxy will perform a NTLM login handshake with the configured user.
Note that "all network communication" includes calls to `cy.visit(host)`, `cy.request(host)` and indirect network communication (when the browser fetches additional resources after the `cy.visit(host)` call).

If domain and workstation are not set, the ntlm-proxy will use the domain of the ntlmHost.

#### Syntax

```javascript
cy.ntlm(ntlmHosts, username, password, [domain, [workstation, [ntlmVersion]]]);
```

- ntlmHosts: array of FQDNs or hostnames of the servers where NTLM authentication shall be applied. The hosts must NOT include protocol or the rest of the url (path and query) - only host:port level authentication is supported. In addition, wildcards are allowed to simplify specifying hosts for a whole intranet. Ports cannot be combined with wildcards. Example: `['localhost:4200', '*.acme.com']`
- username: the username for the account to authenticate with
- password: the password or the account to authenticate with (see [Security advice](#Security-advice) regarding entering passwords)
- domain (optional): the domain for the account to authenticate with (for AD account authentication). Default value: the domain of the ntlmHost.
- workstation (optional): the workstation name of the client. Default value: `os.hostname()`
- ntlmVersion (optional): the version of the NTLM protocol to use. Valid values are 1 and 2. Default value: 2. This can be useful for legacy hosts that don't support NTLMv2 or for certain scenarios where the NTLMv2 handshake fails (the plugin does not implement all features of NTLMv2 yet).

The ntlm command may be called multiple times to setup multiple ntlmHosts, also with different credentials. If the ntlm command is called with the same ntlmHost again, it overwrites the credentials for that ntlmHost. Existing connections are not terminated, but if the server requests reauthentication the new credentials will be used.

If multiple configurations match a hosts, the most specific configuration is applied. The order of priority is:

1. Configuration with hostname and port
2. Configuration with hostname
3. Configuration with wildcard hostname

Configuration set with the ntlm command persists until it is reset (see ntlmReset command) or when the proxy is terminated. Take note that it _is not cleared when the current spec file is finished_.

#### Example

You want to test a IIS website on your intranet `https://ntlm.acme.com` that requires Windows Authentication and allows NTLM. The test user is `acme\bobby` (meaning domain `acme` and username `bobby`), and the password is `brown`.

```javascript
cy.ntlm(["ntlm.acme.com"], "bobby", "brown", "acme");
// Access the ntlm site with user bobby
cy.visit("https://ntlm.acme.com");
// Test actions and asserts here

cy.ntlm(["ntlm.acme.com"], "admin", "secret", "acme");
// Access the ntlm site with user admin
cy.visit("https://ntlm.acme.com");
// Test actions and asserts here

cy.ntlm(["ntlm-legacy.acme.com"], "admin", "secret", "acme", undefined, 1);
// Access the ntlm-legacy site with user admin using NTLMv1
cy.visit("https://ntlm-legacy.acme.com");
// Test actions and asserts here
```

#### <a name="Security-advice"></a> Security advice

Hard coding password into your test specs isn't a great idea, even though it may seem harmless. Test code will end up in a repository, which makes the full credentials for the accounts used in your tests searchable in the repository. Even if the repository is on an internal company hosted server, this is not good practice. The recommended way to handle credentials is to use config files / environment variables, and to have these populated by your release pipeline. Cypress has several options to [provide custom configuration for different environments](https://docs.cypress.io/guides/guides/environment-variables.html#Setting) - pick one that makes sense in your pipeline.

You can then combine this with setting up multiple accounts to test your application using different levels of access (if needed by your application). Using this technique, you should end up with something like this:

```javascript
// Read-only user access
cy.ntlm(
  ["ntlm.acme.com"],
  Cypress.env.NTLM_READONLY_USERNAME,
  Cypress.env.NTLM_READONLY_PASSWORD,
  Cypress.env.NTLM_READONLY_DOMAIN
);
// tests ...

// Admin user access
cy.ntlm(
  ["ntlm.intranet.acme.com"],
  Cypress.env.NTLM_ADMIN_USERNAME,
  Cypress.env.NTLM_ADMIN_PASSWORD,
  Cypress.env.NTLM_ADMIN_DOMAIN
);
// tests ...
```

#### Pro-tip: baseUrl

If you are testing a single site, it is convenient to set the [baseUrl](https://docs.cypress.io/guides/references/best-practices.html#Setting-a-global-baseUrl) parameter in Cypress to the hostname, so you don't have to provide it on every call to `cy.visit()` or `cy.request()`. Set it in `cypress.json` or simply use:

```javascript
Cypress.env.baseUrl = ntlmHost;
```

This will persist until the current spec file is finished.

### cy.ntlmSso(ntlmHosts)

The ntlmSso command is used to configure host for single sign on authentication. After this command, all network communication from cypress to the specified hosts is monitored by the ntlm-proxy. If the server sends an authentication challenge, the ntlm-proxy will perform a NTLM or Negotiate login handshake with the credentials of the user running the test client.
Note that "all network communication" includes calls to `cy.visit(host)`, `cy.request(host)` and indirect network communication (when the browser fetches additional resources after the `cy.visit(host)` call).

#### Syntax

```javascript
cy.ntlmSso(ntlmHosts);
```

- ntlmHosts: array of FQDNs or hostnames of the servers where NTLM or Negotiate authentication with single sign on shall be applied. The hosts must NOT include protocol, port or the rest of the url (path and query) - only host level authentication is supported. In addition, wildcards are allowed to simplify specifying SSO for a whole intranet. Example: `['localhost', '*.acme.com']`

The ntlmSso command may be called multiple times, each call will overwrite the previous ntlmSso configuration.

The NTLM protocol version cannot be specified, it is negotiated automatically. The client will follow the settings in Windows (LMCompatibilityLevel), which could mean that a legacy host with NTLMv1 only cannot be accessed if the client settings don't allow NTLMv1.

Configuration set with the ntlmSso command persists until it is reset (see ntlmReset command) or when the proxy is terminated. Take note that it _is not cleared when the current spec file is finished_.

#### Example

You want to test a IIS website on your intranet `https://ntlm.acme.com` that requires Windows Authentication and allows NTLM.

```javascript
// Enable single sign on all hosts within *.acme.com
cy.ntlmSso(["*.acme.com"]);
// Access the ntlm site with the user running the test client
cy.visit("https://ntlm.acme.com");
// Test actions and asserts here

// Enable single sign on for both ntlm.acme-legacy.com and all hosts within *.acme.com
cy.ntlmSso(["ntlm.acme-legacy.com", "*.acme.com"]);
// Access the legacy site with the user running the test client
cy.visit("https://ntlm.acme-legacy.com");
// Test actions and asserts here
```

### cy.ntlmReset()

The ntlmReset command is used to remove all connections and all configured ntlmHosts from previous ntlm command calls. Since the proxy configuration persists even when a test case or spec file is finished, a good practice is to call ntlmReset in the beforeEach method. This ensures that you have a clean setup at the start of each test.

#### Syntax

```javascript
cy.ntlmReset();
```

#### Example

Using ntlmReset to clear configuration.

```javascript
cy.ntlm(["ntlm.acme.com"], "bobby", "brown", "acme");
cy.visit("https://ntlm.acme.com"); // This succeeds
cy.ntlmReset();
cy.visit("https://ntlm.acme.com"); // This fails (401)
```

## Debugging

When reporting issues with this plugin, please collect debug logs for your scenario as described below and add them to the issue.

### Mac or Linux

1. Open a terminal and go to your project root directory.
2. `DEBUG=cypress:plugin:ntlm-auth npx cypress-ntlm open`
3. Run your cypress tests and view the logs in the terminal.

### Windows

1. Open a cmd window and go to your project root directory.
2. `set DEBUG=cypress:plugin:ntlm-auth`
3. `npx cypress-ntlm open`
4. Run your cypress tests and view the logs in the cmd window.

### Debug logging of NTLM and Negotiate headers

To write also the NTLM and Negotiate headers sent and received by ntlm-proxy, set the environment variable `DEBUG_NTLM_HEADERS=1`. If you use this, take some care with the logs since access to the NTLM and Negotiate headers are an attack vector for the account, especially if you are using NTLMv1.

## Node module API

This plugin can also be called as a Node module. It mimics the behavior of the [run and open methods in Cypress module API](https://docs.cypress.io/guides/guides/module-api.html) - accepting the same arguments, passing them on to Cypress and returning the same value. It will automatically start the ntlm-proxy before calling `cypress.run()`, and it will shut down the ntlm-proxy after the tests have finished.

### Example

```javascript
const cypressNtlmAuth = require("cypress-ntlm-auth");
cypressNtlmAuth
  .run({
    spec: "./cypress/integration/test.spec.js",
  })
  .then((result) => console.log(result))
  .catch((err) => console.log(err));
```

## Notes

### .http-mitm-proxy

The http-mitm-proxy library will create a .http-mitm-proxy folder with generated certificates. This improves performance when re-running tests using the same sites. It is recommended to add this folder to your .gitignore so the certificates don't end up in your repo.

### https on localhost

The NTLM proxy will accept self-signed certificates for sites that are served from localhost. This is convenient for testing local development builds without requiring a full CA chain for the certificates, while still requiring proper certificates from external servers.

### HTTPS/SSL/TLS issues

Getting certificates right can be a burden. When accessing a HTTPS site, the site certificate is validated by ntlm-proxy (just like web browsers do). If the validation fails, the proxy will return an error code (504).

#### Corporate CA certificates

Many corporate intranets utilize SSL inspection, which means that your HTTPS traffic is decrypted, inspected, and then encrypted with an internal corporate certificate. Since Node doesn't trust the corporate certificates CA, it will raise an error. Download the certificate to your machine and set the environment variable `NODE_EXTRA_CA_CERTS` to the full path to the certificate file. This will make Node trust it as a CA.

#### Disable TLS validation

If you are unable to resolve the certificate issues you can use the standard Node workaround by setting the environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0` before starting ntlm-proxy. If you are running Node 11 or later, you will (rightfully) get a warning when doing this, since disabling the certificate validation makes your machine more vulnerable to MITM attacks. When used only in a development environment and only for testing an internal site, the risk is significantly reduced - but I would still strongly recommend resolving the certificate issues instead of relying on the workaround.

## Build instructions

### Transpile

The plugin is written in TypeScript and the git repository does not include the transpiled files. Hence, if you need to build the plugin from source:

```script
npm run build
```

This transpiles the sources into the `dist` folder, copies additional files to `dist` and sets permissions for the launchers.

### Test

To run the unit test suite:

```script
npm test
```

## Credits

- [http-mitm-proxy](https://github.com/joeferner/node-http-mitm-proxy) - this proxy is used to intercept the traffic and inject the NTLM handshake. I chose this one because it includes full https support with certificate generation.
- [ntlm-client](https://github.com/clncln1/node-ntlm-client) - Strong inspiration for the NTLM methods in this library.
- [ntlm-auth](https://github.com/jborean93/ntlm-auth) - Python library for NTLM authentication. Used as a reference implementation to generate NTLM headers for unit tests.
- [express-ntlm](https://github.com/einfallstoll/express-ntlm) - simplified local testing of cypress-ntlm-auth, since no real Windows server was required.
- [Travis-CI](https://travis-ci.com/) - makes automated testing of multiple platforms and multiple node versions so much easier.
