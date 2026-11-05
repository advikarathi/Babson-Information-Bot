# How to add to the knowledge base

The assistant answers only from the `.md` files in this folder. This page is not shown to it.

## Where things go

| Folder | What goes in it | Example |
|---|---|---|
| `contacts.md` | People, offices, emails, addresses | Accounts Payable contact |
| `policies/` | Rules and how they work, one topic per file | `alcohol-and-catering.md` |
| `faqs/` | Questions and answers | `amazon-punchout.md` |
| `job-aids/` | Step-by-step instructions | `payee-onboarding.md` |
| `training/` | Training materials and presentations | `contract-terms-review.md` |
| `processes/` | End-to-end process guides | intake-to-contract, once it launches |
| `_drafts/` | Not ready yet. **Hidden from the assistant** | `intake-to-contract.md` |
| `_templates/` | Blank files to copy. **Hidden from the assistant** | `faq.md` |

You can create new folders whenever you like, and anything inside them is picked up automatically. Only names starting with `_` and files named `README.md` are hidden.

## Add a FAQ, job aid, or training document

1. Copy the matching file from `_templates/` into the right folder and give it a clear name, such as `faqs/contract-intake.md`.
2. Paste in the content as plain text. The assistant can't read PDF, Word, or PowerPoint files directly, or images and screenshots, so describe anything that only appears in a picture.
3. Keep the `Source:` line with the full web address, so answers can link to it.
4. Update the `Last reviewed:` date.
5. Save and redeploy.

## Prepare something before it goes live

Write it in `_drafts/`. When it's ready, move it to the right folder and redeploy. Good for anything with a launch date.

Any line containing the capitalized word `TODO` is also hidden, so you can mark gaps in a live file.

## Before you add a document

- **Is it safe to share publicly?** Anyone visiting the website can get this information from the chat. Leave out passwords, logins, and anything marked confidential or internal, unless its owner approves.
- **Does it replace something?** Update or delete the old version. If two files disagree, the assistant will report both answers to people.
- **Is the wording exact?** The assistant copies names, amounts, and deadlines as written.

## How big can this get?

All the files are sent to the AI with every question, so very large additions cost more and slow answers. Plain text job aids and FAQs are fine. There's plenty of room for your upcoming documents, but paste in the useful content rather than whole manuals. If the total grows past about 300,000 characters, ask a developer to review it.
