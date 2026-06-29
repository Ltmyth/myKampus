import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "My Kampus Portal",
  description: "One-stop portal for course applications, autograded exams, course contents, and attendance.",
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900 custom-scrollbar selection:bg-brand-emerald/30 selection:text-brand-dark flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
