let token: string | null = null;

export function setAccessToken(t: string | null) {
  token = t;
}

export function getAccessToken() {
  return token;
}
