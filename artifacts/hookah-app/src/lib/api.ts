import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("auth_token"));
