function isExpoPushToken(token) {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

async function sendExpoPush(message) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Expo push failed:", res.status, res.statusText, text);
  }
}

module.exports = { isExpoPushToken, sendExpoPush };
