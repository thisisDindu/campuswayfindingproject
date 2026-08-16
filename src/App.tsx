// import NAUWayfinding from "./NAUWayfinding";

// function App() {
  

//   return (
//     <>
//       <NAUWayfinding />
//     </>
//   )
// }

// export default App

import NAUWayfinding from "./NAUWayfinding";
import QRAdmin from "./QRAdmin.tsx";
 
export default function App() {
  // Simple client-side routing — no router library needed
  // /admin  → QR admin page
  // anything else → wayfinding map
  const isAdmin = window.location.pathname.endsWith("/admin");
 
  return isAdmin ? <QRAdmin /> : <NAUWayfinding />;
}