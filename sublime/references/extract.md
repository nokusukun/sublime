# Extract Flow

Lift repeated patterns into a shared module — *only if a second real caller exists today.* The output of extract is always a smaller codebase than the input. Never extract on speculation.

## Step 1: Verify the second caller

Before extracting anything, confirm *two or more real, current callers* exist for the pattern. Speculative extraction — "we will need this again someday" — is banned. If you can only find one caller, stop and report that no extraction is justified. The abstraction appears when the second caller appears; not before.

When in doubt, look for *three* occurrences, not two. Two can be coincidence; three is a pattern.

## Step 2: Name the concept

The shared concept deserves a name that fits the domain, not a framework. If the only name you can find is `utils`, `helpers`, `common`, `shared`, or `misc`, the concept is not ready to extract — you are missing the vocabulary. Find the noun.

If the extracted helper is `formatDate`, the concept is formatting. If it is `retryWithBackoff`, the concept is retries. Name the module after the concept: `formatting.ts`, `retries.ts`, `ids.ts`. Never the dumping ground.

## Step 3: Lift

Move the shared logic into one named module. Update every caller to use it. Delete the duplicated copies. One source of truth per fact — if two places can disagree, one of them is a cache.

During the lift, resist the urge to over-generalize. If the current callers need three of the five possible options, write the function with three options, not five. A future caller can broaden it.

## Step 4: Verify the codebase shrank

The output of sublime extract is always a smaller codebase than the input. If the diff added more lines than it removed, something went wrong — probably abstraction ceremony (factories, interfaces, options objects for optional behavior). Strip it back.

Count lines in the diff. Removed must exceed added. If it does not, either the extraction is premature, or the extracted module is over-engineered.

## Step 5: Present

Present the diff with: the name of the extracted concept, the callers that now use it, and the line-count delta (negative). A good extraction deletes more than it adds and leaves the codebase easier to change, not harder.

### Avoid

- Extracting with one caller and hoping the second appears — it won't, and inlining the now-abstract helper costs more than starting inline would have.
- Naming the new module `utils`, `helpers`, `common`, `shared`, or `misc` — that is a sign the concept is not yet ready to extract.
- Over-parameterizing the extracted function — if current callers use three options, write three, not five.
- Lifting similar-but-not-identical logic and smoothing the differences with flags — you have just recreated the original duplication inside one function.
- Leaving the duplicated copies in place "for now" — extract is not a safe-to-merge partial operation.
- Adding more lines than you removed — if the diff grew, the extraction is over-engineered; strip back to a plain function.
