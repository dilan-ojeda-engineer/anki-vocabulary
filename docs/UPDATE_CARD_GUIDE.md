# Update an existing card

Connect to the same Anki collection used for the original delivery. Choose its deck, click **Load supported notes from deck**, and load the card. Loading does not change Anki.

## 1. Edit card

Edit the text and check the card preview. Choose **Save and continue** to save and approve that text for audio. Saving does not send it to Anki. If you make another edit, save again before continuing.

The editor shows your locally saved draft. **Current Anki card and audio** shows what is already in Anki. **Use the Anki text instead of my saved draft** is an optional action that replaces the saved draft text; use it only when that is your intent.

## 2. Prepare audio

The app keeps existing clips whose spoken text is unchanged. It identifies changed text that needs matching audio and shows a direct **Generate audio for … changed sentences** action. Review the voice and usage estimate before confirming generation. Matching cached audio is reused; a fresh replacement uses provider allowance.

Listen to the current and proposed clips. Use **Replace audio** beside a clip to request a different rendition without changing its text. **Add audio** is optional where the Anki card has no clip. Generated clips remain local until the final update.

## 3. Review changes

Choose the single **Review changes** button. The app selects ready clips automatically, keeps unchanged existing audio, and shows the text differences and current/proposed changed clips together. If something is missing, the screen directs you to the step that needs attention.

If only one clip was replaced and the text stayed the same, the review shows only that audio change. Removing an example also removes its audio reference; old media files are retained.

## 4. Update in Anki

Save and close Anki's editor for this card. Review the destination and differences, acknowledge the review, and choose **Update in Anki**. Check the saved result afterward. No update happens merely by reconnecting, generating audio, or opening a preview.

Unsaved text blocks switching cards/decks and connection refresh; save or discard it first. Editing and listening have no five-minute deadline: Review changes rechecks the loaded Anki state. After a server restart, or when a very old editing context has been evicted, choose **Reload Anki snapshot** beside Review changes. Reloading keeps your saved draft and generated audio. Final write previews still expire after five minutes; choose Review changes again to prepare a fresh comparison without regenerating audio. An ambiguous result must be reconciled before retrying.

For this project's existing disposable setup, close regular Anki normally, run `npm run anki:test`, and refresh the app's connection. The ordinary Anki shortcut opens a different collection. See [setup](../README.md#run-the-local-web-foundation) and [validation limits](evidence/AV-035-note-updates.md).
