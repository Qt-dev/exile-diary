# PoE data extraction

The `update-poe-data` GitHub Actions workflow refreshes the application's generated Path of Exile data every day at 04:17 UTC. It also supports manual dry runs and publishing runs from the Actions UI. All work runs on a GitHub-hosted runner; no developer computer needs to remain online.

## GitHub App setup

The workflow authenticates as a dedicated GitHub App. Create the App under the `Qt-dev` organization so its ownership and credentials are not tied to an individual developer.

You must be an organization owner, or have permission to manage GitHub Apps for the organization.

### 1. Register the App

Open the organization registration page:

<https://github.com/organizations/Qt-dev/settings/apps/new>

Set the registration fields as follows:

| Field | Value |
| --- | --- |
| GitHub App name | `exile-diary-data-updater` or another globally unique variation |
| Description | `Refreshes generated Path of Exile data in Qt-dev/exile-diary.` |
| Homepage URL | `https://github.com/Qt-dev/exile-diary` |
| Callback URL | Leave blank |
| Request user authorization (OAuth) during installation | Disabled |
| Enable Device Flow | Disabled |
| Setup URL | Leave blank |
| Redirect on update | Disabled |
| Webhook Active | Disabled |

This App authenticates only as an installation. It does not sign users in, act on behalf of a user, host a service, or consume webhook events, so callback, setup, device-flow, and webhook settings are unnecessary.

Under **Repository permissions**, configure only:

| Permission    | Access                           |
| ------------- | -------------------------------- |
| Contents      | Read and write                   |
| Pull requests | Read and write                   |
| Metadata      | Read-only, granted automatically |

Leave every other repository permission at **No access**. Leave all organization and account permissions at **No access**, and do not subscribe to any events.

Under **Where can this GitHub App be installed?**, select **Only on this account**. Then select **Create GitHub App**.

GitHub's current registration and minimum-permission guidance is available in [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app) and [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

### 2. Install it on only this repository

After creating the App:

1. Open <https://github.com/organizations/Qt-dev/settings/apps>.
2. Select the new App.
3. Select **Install App** in the sidebar.
4. Select **Install** next to `Qt-dev`.
5. Choose **Only select repositories**.
6. Select only `exile-diary`, then complete the installation.

Do not choose **All repositories**. The workflow creates a token for the current repository, but restricting the installation is the stronger security boundary.

You can review or change the installed repository later at:

<https://github.com/organizations/Qt-dev/settings/installations>

### 3. Generate the private key

Return to the App's settings through:

<https://github.com/organizations/Qt-dev/settings/apps>

On the App's **General** page:

1. Copy the numeric **App ID** shown near the top of the page.
2. Scroll to **Private keys**.
3. Select **Generate a private key**.
4. GitHub downloads a `.pem` file. Store it temporarily in a secure location.

Do not copy the **Client ID** for this workflow. The current workflow uses the token action's supported `app-id` input and expects the numeric App ID.

### 4. Add the Actions variable and secret

Open the repository's Actions variables page:

<https://github.com/Qt-dev/exile-diary/settings/variables/actions>

Create this repository variable:

| Name              | Value                                           |
| ----------------- | ----------------------------------------------- |
| `POE_DATA_APP_ID` | The numeric App ID copied from the General page |

Then open the Actions secrets page:

<https://github.com/Qt-dev/exile-diary/settings/secrets/actions>

Create this repository secret:

| Name                       | Value                                               |
| -------------------------- | --------------------------------------------------- |
| `POE_DATA_APP_PRIVATE_KEY` | The complete contents of the downloaded `.pem` file |

Paste the private key verbatim, including the `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----` header, footer, and all line breaks. Do not base64-encode it. Delete the downloaded key from local storage after confirming the workflow can authenticate.

The names must match [update-poe-data.yml](../../../.github/workflows/update-poe-data.yml):

```yaml
app-id: ${{ vars.POE_DATA_APP_ID }}
private-key: ${{ secrets.POE_DATA_APP_PRIVATE_KEY }}
```

The workflow requests a short-lived installation token scoped to the current repository and explicitly limits that token to `contents: write` and `pull-requests: write`. The token is revoked when the job finishes and otherwise expires after one hour. See the [`actions/create-github-app-token` documentation](https://github.com/actions/create-github-app-token) for the token behavior.

### 5. Verify the configuration

Before publishing:

1. Confirm the App installation lists only `Qt-dev/exile-diary`.
2. Confirm the repository variable is named exactly `POE_DATA_APP_ID`.
3. Confirm the repository secret is named exactly `POE_DATA_APP_PRIVATE_KEY`.
4. Confirm the App still has only Contents and Pull requests read/write access.
5. Run the workflow manually with `publish` disabled.

An authentication failure in the first workflow step usually means the App ID is wrong, the private key was copied incompletely, or the App is not installed on `Qt-dev/exile-diary`.

The workflow uses the App's bot identity as the commit author. No personal access token is required.

## Rollout

1. Merge the in-repository extractor and workflow onto the default branch.
2. Open <https://github.com/Qt-dev/exile-diary/actions/workflows/update-poe-data.yml>.
3. Select **Run workflow** and leave `publish` disabled for the first run.
4. Confirm extraction and validation pass and the summary reports whether data changed.
5. Run it again with `publish` enabled. If data changed, confirm the App opens `chore: refresh extracted PoE data` from `automation/poe-data-refresh`.
6. Review and merge the PR normally. Auto-merge is intentionally not enabled.

The daily schedule is active only after the workflow file exists on the default branch.

## Local commands

```bash
npm ci --prefix tools/poe-data-extractor
npm run data:extract
npm run data:check
npm test --prefix tools/poe-data-extractor
```

`data:extract` may update only the extractor patch configuration and these generated datasets:

- `areas.json`
- `items.json`
- `mapMods.json`
- `worldAreas.json`
- `uniques.json`
- `events.json`

The scheduled workflow fails if any other tracked path changes.

## Failure handling

- Patch lookup, download, generation, publishing, validation, or unexpected-file failures make the workflow fail with a nonzero status.
- The job summary records the patch, whether generated data changed, whether the same tree is already in the automation PR, and whether publishing was requested.
- Rerun a failed job after an upstream outage. Use a manual publishing run for urgent patch launches instead of changing the daily schedule.
