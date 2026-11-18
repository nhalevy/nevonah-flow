import { ConfirmSignIn } from "./confirm-sign-in";

// The sign-in link in the email lands here. The tokens are in the URL #hash,
// which only the browser can read, so the work happens in a client component.
export default function ConfirmPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <ConfirmSignIn />
    </main>
  );
}
