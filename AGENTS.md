# Release Workflow

The user requested that updates be stocked locally while Vercel is paused.

- Use this persistent checkout, not a temporary directory, for future work.
- Implement and verify requested changes on a local `codex/` branch.
- Commit completed updates locally and record them in `RELEASE_STOCK.md`.
- Do not push branches, merge into remote main, or trigger Vercel deployments
  unless the user explicitly requests publication. Ordinary implementation
  requests do not authorize publication under this workflow.
- The user phrase "ストックしていた更新を反映して" authorizes publication of the
  recorded stock. Check the latest remote state, preserve unrelated work,
  validate the accumulated changes, then publish and verify deployment.
- Some updates were already pushed before this workflow began. Distinguish
  those from local-only stock; they may require a Vercel redeployment rather
  than another code push.
- Mark an update published only after the production deployment is verified.
  If deployment remains blocked, keep it pending and report the blocker.
- Do not change billing, plans, or account settings as part of publication.

Read `RELEASE_STOCK.md` before implementing or publishing updates.
