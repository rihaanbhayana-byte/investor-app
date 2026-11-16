// Every page fades up gently when you navigate to it.
export default function Template({ children }) {
  return <div className="motion-safe:animate-page-in">{children}</div>;
}
