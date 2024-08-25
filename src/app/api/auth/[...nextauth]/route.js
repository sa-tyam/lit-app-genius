import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
        // Persist the user ID and OAuth access token to the token object
        if (account) {
          token.accessToken = account.access_token;
        }
        if (user) {
          token.id = user.id; // Include the user ID
        }
        return token;
      },
      async session({ session, token }) {
        // Attach the access token and user ID to the session object
        session.accessToken = token.accessToken;
        session.user.id = token.sub; // This is the unique identifier for the user
        return session;
      },
  },
});

export { handler as GET, handler as POST };
