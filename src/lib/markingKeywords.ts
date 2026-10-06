// Turns a short-answer marking point into the keywords the exam scorer looks for in a student's answer. The same rule is used
// when a teacher types a point by hand (Add question) and when an AI-drafted question is added, so both mark identically.
const STOP_WORDS = new Set(['a','an','the','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','up','about','into','through','during','before','after','above','below','between','each','both','few','more','most','other','some','such','no','nor','not','only','same','so','than','too','very','just','because','as','until','while','although','and','but','or','nor','so','yet','if','when','where','why','how','all','any','both','each','every','either','neither','one','two','three','four','five','six','seven','eight','nine','ten','that','this','these','those','it','its','their','they','them','he','she','his','her','we','our','you','your','i','my','me','us','who','which','what','meaning','making','requires','require','cannot','can','also','must','want','other','offer'])

export function keywordsFor(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}
