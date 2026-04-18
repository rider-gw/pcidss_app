import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [time, setTime] = useState(new Date());
  const [currentView, setCurrentView] = useState("Dashboard");
  
  // States for the form
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Schema["Todo"]["type"]["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Clock Effect
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Auth & Data Fetch
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] || [];
        setUserGroups(groups);
        const attributes = await fetchUserAttributes();
        setUserEmail(attributes.email || "Unknown");
      } catch (err) { console.error(err); }
    };
    fetchUserDetails();
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // Handlers
  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!content) return;
    await client.models.Todo.create({ content, isDone: false, priority, dueDate });
    setContent("");
  }
  async function deleteTodo(id: string) { await client.models.Todo.delete({ id }); }
  async function toggleTodo(todo: Schema["Todo"]["type"]) {
    await client.models.Todo.update({ id: todo.id, isDone: !todo.isDone });
  }

  return (
    <Authenticator>
      {({ signOut }) => (
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gridTemplateRows: "70px 1fr", height: "100vh", fontFamily: "sans-serif" }}>
          
          {/* TOP TITLE BAR */}
          <header style={{ 
            gridColumn: "1 / -1", backgroundColor: "#047d95", color: "white", 
            display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)", zIndex: 10 
          }}>
            <div style={{ fontSize: "0.8rem", width: "300px" }}>
              <div>Logged in: <strong>{userEmail}</strong></div>
              <div>Role: {userGroups.join(", ") || "GUEST"}</div>
            </div>
            
            <h2 style={{ margin: 0 }}>PCI-DSS Audit Portal</h2>
            
            <div style={{ fontSize: "0.8rem", textAlign: "right", width: "300px" }}>
              <div>{time.toLocaleDateString()} {time.toLocaleTimeString()}</div>
              <div>{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
            </div>
          </header>

          {/* VERTICAL NAVBAR */}
          <nav style={{ backgroundColor: "#232f3e", color: "white", padding: "20px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setCurrentView("Dashboard")} style={navBtnStyle}>📊 Dashboard</button>
            
            {(userGroups.includes("ADMIN") || userGroups.includes("ISA")) && (
              <button onClick={() => setCurrentView("Evidence")} style={navBtnStyle}>📁 Evidence Library</button>
            )}
            
            {userGroups.includes("ADMIN") && (
              <button onClick={() => setCurrentView("Settings")} style={navBtnStyle}>⚙️ System Settings</button>
            )}
            
            <div style={{ marginTop: "auto" }}>
              <button onClick={signOut} style={{ ...navBtnStyle, backgroundColor: "#d9534f" }}>Logout</button>
            </div>
          </nav>

          {/* MAIN DISPLAY PAGE */}
          <main style={{ backgroundColor: "#f4f7f6", overflowY: "auto", padding: "20px" }}>
            
            {/* BREADCRUMBS */}
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "10px" }}>
              Home / {currentView}
            </div>
            <h2 style={{ marginTop: 0 }}>{currentView}</h2>

            {/* PAGE CONTENT: Only show Todo list on Dashboard */}
            {currentView === "Dashboard" ? (
              <div>
                {/* SUMMARY CARDS */}
                <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                  <div style={cardStyle}><strong>Total:</strong> {todos.length}</div>
                  <div style={cardStyle}><strong>Compliant:</strong> {todos.filter(t=>t.isDone).length}</div>
                </div>

                {/* SEARCH & FORM (Simplified for space) */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                   <input placeholder="Filter requirements..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} style={{ flex: 1, padding: "10px" }}/>
                </div>

                {/* LIST SCROLL AREA */}
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {todos
                    .filter(t => t.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice().sort((a,b) => (a.isDone === b.isDone ? 0 : a.isDone ? 1 : -1))
                    .map(todo => (
                      <li key={todo.id} style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <strong>{todo.content}</strong>
                          <div style={{ fontSize: "0.7rem", color: "#888" }}>Priority: {todo.priority} | Due: {todo.dueDate}</div>
                        </div>
                        <div>
                           {(userGroups.includes("ADMIN") || userGroups.includes("ISA")) && (
                             <input type="checkbox" checked={todo.isDone || false} onChange={() => toggleTodo(todo)} />
                           )}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                {currentView} Content coming soon...
              </div>
            )}
          </main>
        </div>
      )}
    </Authenticator>
  );
}

// STYLES
const navBtnStyle = {
  padding: "12px", textAlign: "left" as "left", backgroundColor: "transparent", 
  color: "white", border: "1px solid #3e4b5b", borderRadius: "4px", cursor: "pointer", width: "100%"
};

const cardStyle = {
  flex: 1, padding: "20px", backgroundColor: "white", borderRadius: "8px", 
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)", textAlign: "center" as "center"
};



