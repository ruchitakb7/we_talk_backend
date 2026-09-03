
export function generateUsername(email: string) {
  const namePart = email.split("@")[0];

  const cleanedName = (namePart || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 5)
    .toLowerCase();

  const randomNumber = Math.floor(
    10000 + Math.random() * 90000
  );

  return `${cleanedName}${randomNumber}`;
}