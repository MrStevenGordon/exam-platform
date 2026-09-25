// The address in Smart Play that opens Topic Mastery on a lesson's topic. Smart Play matches
// topics by name, so it is given the subject and topic name as plain text. Nothing else about
// the lesson or the student is sent.
export function playTopicHref(topic: { name: string; subject: string }): string {
  const q = new URLSearchParams({ subject: topic.subject, topic: topic.name, from: 'learning' })
  return `/play/topic-mastery?${q.toString()}`
}
