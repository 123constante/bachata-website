/**
 * An email address that wraps cleanly at 360-390px (audit L1): a break point before "@" and,
 * only when one part is still too long, overflow-wrap:anywhere -- never break-all's mid-word split.
 */
export const EmailText = ({ email, className = "" }: { email: string; className?: string }) => {
  const at = email.indexOf("@");
  return (
    <span data-email className={`[overflow-wrap:anywhere] ${className}`.trim()}>
      {at > 0 ? (
        <>
          {email.slice(0, at)}
          <wbr />
          {email.slice(at)}
        </>
      ) : (
        email
      )}
    </span>
  );
};
