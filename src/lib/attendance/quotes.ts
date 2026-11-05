import { prisma } from "@/lib/prisma";
import { keyToDate } from "./dates";

/** Starter set, added to DailyQuote once. Admins can add or retire rows in the table later. */
const STARTER_QUOTES: { text: string; author?: string }[] = [
  { text: "Every call you make today is a door you're opening for someone's career.", },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Your energy introduces you before you even speak. Bring your best today." },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "A great placement starts with one great conversation. Have it today." },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Today's follow-up is tomorrow's interview. Don't skip it." },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Every 'no' brings you one step closer to a 'yes'. Keep submitting." },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Teamwork makes the dream work. Help a teammate win today." },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "You are one submission away from changing someone's life." },
  { text: "Motivation gets you going, habit keeps you growing.", author: "John C. Maxwell" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it." },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
  { text: "A positive attitude turns a tough day into a learning day." },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Do something today that your future self will thank you for." },
  { text: "Consistency is what transforms average into excellence." },
  { text: "Your consultants are counting on you. Make today count." },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Celebrate small wins; they build the big ones." },
];

/** Adds the starter quotes the first time (startup); later edits to the table are left alone */
export async function ensureQuotes() {
  if ((await prisma.dailyQuote.count()) > 0) return;
  await prisma.dailyQuote.createMany({ data: STARTER_QUOTES.map((q) => ({ text: q.text, author: q.author ?? null })), skipDuplicates: true });
  console.log(`[attendance] added ${STARTER_QUOTES.length} daily quotes`);
}

/** Same quote for everyone on a given day, rotating through the active quotes */
export async function quoteForDay(day: string) {
  const quotes = await prisma.dailyQuote.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, text: true, author: true } });
  if (quotes.length === 0) return null;
  const dayNumber = Math.floor(keyToDate(day).getTime() / 86_400_000);
  return quotes[dayNumber % quotes.length];
}
