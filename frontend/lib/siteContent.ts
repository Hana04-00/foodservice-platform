/**
 * Static marketing content for the public website. Operational data (plans,
 * service areas, orders, cancellations) comes from the API — this file is only
 * the copy that never changes without a redeploy.
 */

export const TRUST_ICONS: { icon: string; label: string }[] = [
  { icon: "leaf", label: "Fresh Ingredients" },
  { icon: "sparkle", label: "Hygienic Kitchen" },
  { icon: "shield", label: "No Preservatives" },
  { icon: "home", label: "Home-Style Taste" },
];

export const WHY_CHOOSE_US: { title: string; body: string }[] = [
  {
    title: "Home-style cooking",
    body: "Every thali is cooked the way it would be at home — modest oil, fresh spices, no shortcuts.",
  },
  {
    title: "Hygienic & clean kitchen",
    body: "A dedicated kitchen with daily deep-cleaning, covered storage and packed-to-order tiffins.",
  },
  {
    title: "Flexible plans & easy management",
    body: "Pick your weekdays and meal type. Change or pause your plan from your dashboard anytime.",
  },
  {
    title: "Cancellations with carry-forward credit",
    body: "Cancel a meal before the cutoff and its value is credited back, carried forward to future meals.",
  },
];

export const ABOUT_PARAGRAPHS: string[] = [
  "Ghar Se Tiffin started in a single home kitchen with a simple promise: a hot, balanced, home-style meal delivered on time, every working day.",
  "We cook in small batches from a fixed weekly menu — dal, sabzi, roti, rice and a little something sweet — using fresh produce bought the same morning. No preservatives, no reheated leftovers, no mystery gravy.",
  "Today we serve hundreds of plates a day across the city, but the kitchen still runs on the same rule it started with: if we wouldn't serve it at our own table, it doesn't go in the tiffin.",
];

export const TESTIMONIALS: { name: string; area: string; quote: string }[] = [
  {
    name: "Aarti Sharma",
    area: "Indiranagar",
    quote:
      "It genuinely tastes like my mother's cooking. The lunch reaches my desk warm at 12:45 sharp every single day.",
  },
  {
    name: "Rohan Mehta",
    area: "Koramangala",
    quote:
      "I travel a lot for work. Being able to cancel a day before 10 AM and get the credit back is the reason I stayed.",
  },
  {
    name: "Priya Nair",
    area: "Sarjapur Road",
    quote:
      "Six days of lunch and dinner for my whole family. The portions are honest and the rotation keeps it interesting.",
  },
  {
    name: "Imran Khan",
    area: "BTM Layout",
    quote:
      "No preservatives, light on oil, and the dashboard shows me exactly what I've been billed for. Zero surprises.",
  },
];

/** Testimonial videos — replace src with real uploads in /public/videos. */
export const TESTIMONIAL_VIDEOS: { title: string; poster: string; src: string }[] = [
  {
    title: "A week of lunches with the Sharmas",
    poster: "/images/hero-tiffin.svg",
    src: "/videos/testimonial-1.mp4",
  },
  {
    title: "Why Rohan switched to Ghar Se Tiffin",
    poster: "/images/lunch-rajma-chawal.svg",
    src: "/videos/testimonial-2.mp4",
  },
];

export const MENU_PREVIEW_SLUGS = [
  "lunch-rajma-chawal",
  "lunch-paneer-butter-masala",
  "dinner-dal-khichdi",
  "dinner-palak-paneer",
];
