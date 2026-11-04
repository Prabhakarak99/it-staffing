// Pure helpers shared by the send API and the mailbox UI (no server imports)

/** "Name <a@x.com>, b@y.com" → ["a@x.com", "b@y.com"] */
export function addresses(list: string) {
  return [...list.matchAll(/[^\s<>,;"']+@[^\s<>,;"']+/g)].map((m) => m[0].toLowerCase());
}

/** Recipients to pre-fill for a reply / reply all, leaving out the user's own address */
export function replyRecipients(
  original: { from: string; to: string; cc: string; replyTo: string },
  ownEmail: string,
  all: boolean,
) {
  const me = ownEmail.toLowerCase();
  const to = addresses(original.replyTo || original.from).filter((a) => a !== me);
  if (!all) return { to: to.join(", "), cc: "" };
  const cc = [...new Set([...addresses(original.to), ...addresses(original.cc)])].filter((a) => a !== me && !to.includes(a));
  return { to: to.join(", "), cc: cc.join(", ") };
}

/** "Jane Doe <jane@x.com>" → "Jane Doe"; bare address stays as is */
export function displayName(from: string) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  return (m?.[1] || from).trim();
}
