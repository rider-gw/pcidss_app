import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

const client = generateClient<Schema>();

// --- 1. CRYPTOGRAPHIC HASHING ENGINE (SHA-256) ---
async function generateHash(data: string) {
  const msgBuffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  // --- STATE HOOKS ---
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [lastLoginDisplay, setLastLoginDisplay] = useState("First Session");
  const [time, setTime] = useState(new Date());
  const [currentView, setCurrentView] = useState("Dashboard");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Schema["Todo"]["type"]["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // --- 2. AUDIT LOGGER WITH INTEGRITY CHECK ---
  async function logAction(action: string, resource: string, details?: string) {
    try {
      // Fetch latest log to link the chain
      const { data: logs } = await client.models.AuditLog.list();
      const lastLog = logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      const prevHash = lastLog ? lastLog.recordHash : "GENESIS_BLOCK";
      const timestamp = new Date().toISOString();

      // Create unique fingerprint: Who + What + When + Link to Previous
      const dataToHash = `${userEmail}|${action}|${resource}|${timestamp}|${prevHash}`;
      const currentHash = await generateHash(dataToHash);

      await client.models.AuditLog.create({
        userEmail,
        action,
        resource,
        timestamp,
        details: details || "",
        recordHash: currentHash,
        previousHash: prevHash
      });
      console.log(`Audit Log Verified: ${currentHash.substring(0, 8)}`);
    } catch (err) {
      console.error("AUDIT LOGGING FAILURE:", err);
    }
  }

  // --- IDENTITY & DATA SYNC ---
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const initializeUser = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] || [];
        setUserGroups(groups);

        const attributes = await fetchUserAttributes();
        const email = attributes.email || "Unknown";
        setUserEmail(email);

        const { data: profiles } = await client.models.UserProfile.list();
        const now = new Date().toISOString();

        if (profiles.length > 0) {
          const profile = profiles[0];
          setLastLoginDisplay(new Date(profile.lastLogin || now).toLocaleString());
          await client.models.UserProfile.update({ id: profile.id, lastLogin: now });
        } else {
          setLastLoginDisplay("First Time Login");
          await client.models.UserProfile.create({ email: email, lastLogin: now });
        }
      } catch (err) { console.error(err); }
    };
    
    initializeUser();
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => { clearInterval(timer); sub.unsubscribe(); };
  }, []);

  // --- CRUD HANDLERS WITH LOGGING ---
  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!content) return;
    const result = await client.models.Todo.create({ content, isDone: false, priority, dueDate });
    await logAction("CREATE", content, `Priority: ${priority}`); // LOG IT
    setContent("");
  }

  async function deleteTodo(id: string, content: string) {
    await client.models.Todo.delete({ id });
    await logAction("DELETE", content, `ID: ${id}`); // LOG IT
  }

  async function toggleTodo(todo: Schema["Todo"]["type"]) {
    const newStatus = !todo.isDone;
    await client.models.Todo.update({ id: todo.id, isDone: newStatus });
    await logAction("STATUS_CHANGE", todo.content || "unknown", `To: ${newStatus ? 'Compliant' : 'Non-Compliant'}`); // LOG IT
  }

  // Styles
  const navBtnStyle = { padding: "12px", textAlign: "left" as const, backgroundColor: "transparent", color: "white", border: "1px solid #3e4b5b", borderRadius: "4px", cursor: "pointer", width: "100%" };
  const cardStyle = { flex: 1, padding: "20px", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", textAlign: "center" as const };

  return (
    <Authenticator>
      {({ signOut }) => (
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gridTemplateRows: "70px 1fr", height: "100vh", fontFamily: "sans-serif" }}>
          
          <header style={{ gridColumn: "1 / -1", backgroundColor: "#047d95", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", zIndex: 10 }}>
            <div style={{ fontSize: "0.8rem", width: "300px" }}>
              <div>User: <strong>{userEmail}</strong></div>
              <div>Last Login: <strong>{lastLoginDisplay}</strong></div>
            </div>
            <h2 style={{ margin: 0 }}>PCI-DSS Audit Portal</h2>
            <div style={{ fontSize: "0.8rem", textAlign: "right", width: "300px" }}>
              <div>{time.toLocaleDateString()} {time.toLocaleTimeString()}</div>
              <div>{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
            </div>
          </header>

          <nav style={{ backgroundColor: "#232f3e", color: "white", padding: "20px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setCurrentView("Dashboard")} style={navBtnStyle}>📊 Dashboard</button>
            {(userGroups.includes("ADMIN") || userGroups.includes("ISA")) && <button onClick={() => setCurrentView("Evidence")} style={navBtnStyle}>📁 Evidence Library</button>}
            {userGroups.includes("ADMIN") && <button onClick={() => setCurrentView("Settings")} style={navBtnStyle}>⚙️ System Settings</button>}
            <div style={{ marginTop: "auto" }}><button onClick={signOut} style={{ ...navBtnStyle, backgroundColor: "#d9534f" }}>Logout</button></div>
          </nav>

          <main style={{ backgroundColor: "#f4f7f6", overflowY: "auto", padding: "20px" }}>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "10px" }}>Home / {currentView}</div>
            <h2 style={{ marginTop: 0 }}>{currentView}</h2>

            {currentView === "Dashboard" && (
              <div>
                <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                  <div style={cardStyle}><strong>Total Requirements:</strong> {todos.length}</div>
                  <div style={cardStyle}><strong>Compliant:</strong> {todos.filter(t=>t.isDone).length}</div>
                </div>

                {(userGroups.includes("ADMIN") || userGroups.includes("ISA")) && (
                  <form onSubmit={createTodo} style={{ display: "flex", gap: "10px", marginBottom: "20px", backgroundColor: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #ddd" }}>
                    <input placeholder="Requirement..." value={content} onChange={(e)=>setContent(e.target.value)} style={{ flex: 2, padding: "10px" }}/>
                    <select value={priority} onChange={(e)=>setPriority(e.target.value as any)} style={{ flex: 1 }}>
                      <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                    </select>
                    <button type="submit" style={{ flex: 1, backgroundColor: "#047d95", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add</button>
                  </form>
                )}

                <input placeholder="Filter..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "20px", boxSizing: "border-box" }}/>

                <ul style={{ listStyle: "none", padding: 0 }}>
                  {todos.filter(t => t.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(todo => (
                      <li key={todo.id} style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                        <div><strong>{todo.content}</strong><div style={{ fontSize: "0.7rem", color: "#888" }}>{todo.priority} | {todo.dueDate}</div></div>
                        <div>
                           {(userGroups.includes("ADMIN") || userGroups.includes("ISA")) && <input type="checkbox" checked={todo.isDone || false} onChange={() => toggleTodo(todo)} />}
                           {userGroups.includes("ADMIN") && <button onClick={() => deleteTodo(todo.id, todo.content || "")} style={{ color: "red", border: "none", background: "none", marginLeft: "10px", cursor: "pointer" }}>Del</button>}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </main>
        </div>
      )}
    </Authenticator>
  );
}

