import Link from "next/link";

type AuthFooterProps = {
  question: string;
  linkLabel: string;
  linkHref: string;
};

/**
 * Secondary question + primary action link, shown at the bottom of the auth
 * screens. Mirrors the Figma `AuthFooter` component.
 */
export function AuthFooter({ question, linkLabel, linkHref }: AuthFooterProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 text-center text-body-md">
      <p className="w-full text-muted-foreground">{question}</p>
      <Link
        href={linkHref}
        className="w-full rounded-1 text-link focus-visible:shadow-focus-ring focus-visible:outline-none"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
