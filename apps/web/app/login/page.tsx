"use client";

import { Footer } from "@/components/footer";
import { GoogleButton } from "@/components/google-button";
import { LabeledField } from "@/components/labeled-field";
import { PaddleLogo } from "@/components/logo";
import { api, setAuth } from "@/lib/api";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body =
        mode === "login" ? { email, password } : { name, email, password };
      const res = await api<{ token: string; user: object }>(`/auth/${mode}`, {
        method: "POST",
        json: body,
      });
      setAuth(res.token, res.user);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/sessions");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", mt: 8, px: 2 }}>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        justifyContent={"center"}
        mb={2}
      >
        <PaddleLogo size={34} />
        <Typography variant="h4">PicklePlay</Typography>
      </Stack>
      <Card>
        <CardContent>
          <form onSubmit={submit}>
            <Stack spacing={2} alignContent="center" width="100%">
              {mode === "register" && (
                <LabeledField
                  label="Name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <LabeledField
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <LabeledField
                label="Password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" size="large">
                {mode === "login" ? "Log in" : "Create account"}
              </Button>
              <GoogleButton onError={setError} />
              {mode === "login" ? (
                <Link
                  href="/welcome"
                  underline="none"
                  fontWeight={700}
                  sx={{ color: "secondary.main" }}
                >
                  New here? Get started
                </Link>
              ) : (
                <Link
                  component="button"
                  type="button"
                  onClick={() => setMode("login")}
                >
                  Have an account? Log in
                </Link>
              )}
            </Stack>
          </form>
        </CardContent>
      </Card>
      <Box mt={6}>
        <Footer />
      </Box>
    </Box>
  );
}
