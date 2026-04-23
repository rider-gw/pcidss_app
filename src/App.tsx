// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import { fetchAuthSession, fetchUserAttributes } from '@aws-amplify/auth';
import * as XLSX from 'xlsx'; // Requirement: npm install xlsx
import "@aws-amplify/ui-react/styles.css";

const client = generateClient() as any;
let isInitializing = false;

async function generateHash(data: string) {
  const msgBuffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [userProfiles, setUserProfiles] = useState([]);
  const [assets, setAssets] = useState([]);
  const [userGroupAssignments, setUserGroupAssignments] = useState([]);
  const [pciControls, setPciControls] = useState([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [lastLoginDisplay, setLastLoginDisplay] = useState("First Session");
  const [time, setTime] = useState(new Date());
  const [currentView, setCurrentView] = useState("Dashboard");
  // const [dbStatus, setDbStatus] = useState("");

  const [newAssetId, setNewAssetId] = useState("");
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("SERVER");
  const [newAssetStatus, setNewAssetStatus] = useState("ACTIVE");

  // PCI Control form state
  const [newControlName, setNewControlName] = useState("");
  const [newControlType, setNewControlType] = useState("PREVENTATIVE");
  const [newControlMeasure, setNewControlMeasure] = useState("ADMINISTRATIVE");
  const [newControlDescription, setNewControlDescription] = useState("");
  const [newControlRequirement, setNewControlRequirement] = useState("");
  const [newControlStatus, setNewControlStatus] = useState("ACTIVE");

  // Modal state for group assignment
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState("AUDITOR");

  // --- 1. ASSET IMPORT LOGIC (EXCEL) ---
  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

      for (const row of data as any) {
        await client.models.Asset.create({
          assetId: row["Asset ID"] || row["assetId"] || `AST-${Math.random().toString(36).substr(2, 5)}`,
          name: row["Name"] || row["name"] || "Unnamed Asset",
          type: (row["Type"] || row["type"] || "SERVER").toUpperCase() as any,
          status: ["ACTIVE"]
        });
      }
      await logAction("ASSET_IMPORT", "Excel Inventory", `Imported ${data.length} records`);
      alert(`Imported ${data.length} assets successfully.`);
    };
    reader.readAsBinaryString(file);
  }

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    try {
      await client.models.Asset.create({
        assetId: [newAssetId || `AST-${Math.random().toString(36).substr(2, 5)}`],
        name: [newAssetName || "Unnamed Asset"],
        type: (newAssetType || "SERVER").toUpperCase() as any,
        status: [newAssetStatus || "ACTIVE"]
      });
      await logAction("ASSET_CREATE", "Manual Entry", `Created asset ${newAssetId || "generated"}`);
      setNewAssetId("");
      setNewAssetName("");
      setNewAssetType("SERVER");
      setNewAssetStatus("ACTIVE");
      alert("Asset created successfully.");
    } catch (err) { console.error(err); alert("Failed to create asset."); }
  }

  // --- 4. PCI CONTROL LOGIC ---
  async function handleControlExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

      for (const row of data as any) {
        await client.models.PCIControl.create({
          controlName: [row["Control Name"] || row["controlName"] || row["Name"] || "Unnamed Control"],
          controlType: (row["Control Type"] || row["controlType"] || row["Type"] || "PREVENTATIVE").toUpperCase() as any,
          controlMeasure: (row["Control Measure"] || row["controlMeasure"] || row["Measure"] || "ADMINISTRATIVE").toUpperCase() as any,
          description: [row["Description"] || row["description"] || ""],
          pciRequirement: [row["PCI Requirement"] || row["pciRequirement"] || row["Requirement"] || ""],
          status: ["ACTIVE"],
          createdBy: [userEmail],
          createdAt: [new Date().toISOString()]
        });
      }
      await logAction("CONTROL_IMPORT", "Excel Import", `Imported ${data.length} PCI controls`);
      alert(`Imported ${data.length} PCI controls successfully.`);
    };
    reader.readAsBinaryString(file);
  }

  async function handleAddControl(e: React.FormEvent) {
    e.preventDefault();
    try {
      await client.models.PCIControl.create({
        controlName: [newControlName || "Unnamed Control"],
        controlType: (newControlType || "PREVENTATIVE").toUpperCase() as any,
        controlMeasure: (newControlMeasure || "ADMINISTRATIVE").toUpperCase() as any,
        description: [newControlDescription || ""],
        pciRequirement: [newControlRequirement || ""],
        status: [newControlStatus || "ACTIVE"],
        createdBy: [userEmail],
        createdAt: [new Date().toISOString()]
      });
      await logAction("CONTROL_CREATE", "Manual Entry", `Created control: ${newControlName}`);
      setNewControlName("");
      setNewControlType("PREVENTATIVE");
      setNewControlMeasure("ADMINISTRATIVE");
      setNewControlDescription("");
      setNewControlRequirement("");
      setNewControlStatus("ACTIVE");
      alert("PCI Control created successfully.");
    } catch (err) { console.error(err); alert("Failed to create PCI control."); }
  }

  // --- 2. IDENTITY & LOGGING ---
  const initializeUser = async () => {
    if (isInitializing) return;
    isInitializing = true;
    try {
      const session = await fetchAuthSession();
      setUserGroups(session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] || []);
      const attributes = await fetchUserAttributes();
      const email = attributes.email || "Unknown";
      setUserEmail(email);
      const { data: allProfiles } = await client.models.UserProfile.list();
      const myProfile = allProfiles.find(p => p.email === email);
      const now = new Date().toISOString();
      if (myProfile) {
        setLastLoginDisplay(new Date(myProfile.lastLogin || now).toLocaleString());
        await client.models.UserProfile.update({ id: myProfile.id, lastLogin: [now] });
      } else {
        await client.models.UserProfile.create({ email: [email], lastLogin: [now] });
      }
    } catch (err) { console.error(err); } finally { isInitializing = false; }
  };

  async function logAction(action: string, resource: string, details?: string) {
    try {
      const { data: logs } = await client.models.AuditLog.list();
      const sorted = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const prevHash = sorted.length > 0 ? sorted[0].recordHash : "GENESIS_BLOCK";
      const timestamp = new Date().toISOString();
      const currentHash = await generateHash(`${userEmail}|${action}|${resource}|${timestamp}|${prevHash}`);
      await client.models.AuditLog.create({ userEmail: [userEmail], action: [action], resource: [resource], timestamp: [timestamp], details: [details || ""], recordHash: [currentHash], previousHash: [prevHash] });
    } catch (err) { console.error(err); }
  }

  // --- 3. USER GROUP ASSIGNMENT ---
  async function handleAssignUserToGroup() {
    if (!selectedUserEmail || !selectedGroup) {
      alert("Please select a user and group");
      return;
    }

    try {
      // Call the mutation to add user to group
      await client.mutations.addUserToGroup({
        username: selectedUserEmail,
        groupName: selectedGroup
      });

      // Record the assignment in the database
      await client.models.UserGroupAssignment.create({
        userEmail: [selectedUserEmail],
        groupName: [selectedGroup],
        assignedBy: [userEmail],
        assignedAt: [new Date().toISOString()],
        notes: [`Assigned to ${selectedGroup} group by admin`]
      });

      // Log the action
      await logAction("USER_GROUP_ASSIGNMENT", selectedUserEmail, `Assigned to group: ${selectedGroup}`);

      alert(`Successfully assigned ${selectedUserEmail} to ${selectedGroup}`);
      setShowGroupModal(false);
      setSelectedUserEmail("");
      setSelectedGroup("AUDITOR");
    } catch (err) {
      console.error(err);
      alert("Failed to assign user to group. Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  function getUserCurrentGroup(email: string): string {
    const assignment = userGroupAssignments
      .filter(a => a.userEmail === email)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
    return assignment.length > 0 ? assignment[0].groupName || "VIEWER" : "VIEWER";
  }

  // async function checkDBStatus() {
  //   try {
  //     setDbStatus("Checking database...");
  //     const assetRes = await client.models.Asset.list();
  //     const controlRes = await client.models.PCIControl.list();
  //     const userRes = await client.models.UserProfile.list();
  //     const auditRes = await client.models.AuditLog.list();
  //     const groupRes = await client.models.UserGroupAssignment.list();
  //     const assetCount = assetRes.data.length;
  //     const controlCount = controlRes.data.length;
  //     const userCount = userRes.data.length;
  //     const auditCount = auditRes.data.length;
  //     const groupCount = groupRes.data.length;
  //     setDbStatus(`DB Connected. Records: Assets(${assetCount}), Controls(${controlCount}), Users(${userCount}), AuditLogs(${auditCount}), Groups(${groupCount})`);
  //   } catch (err) {
  //     console.error(err);
  //     setDbStatus(`DB Error: ${err instanceof Error ? err.message : "Unknown error"}`);
  //   }
  // }

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    initializeUser();
    // const subs = [
    //   client.models.UserProfile.observeQuery().subscribe({ next: ({ items }) => setUserProfiles([...items]) }),
    //   client.models.Asset.observeQuery().subscribe({ next: ({ items }) => setAssets([...items]) }),
    //   client.models.UserGroupAssignment.observeQuery().subscribe({ next: ({ items }) => setUserGroupAssignments([...items]) }),
    //   client.models.PCIControl.observeQuery().subscribe({ next: ({ items }) => setPciControls([...items]) }),
    // ];
    return () => { clearInterval(timer); /* subs.forEach(s => s.unsubscribe()); */ };
  }, []);

  const navBtnStyle = (view: string) => ({
    padding: "12px", textAlign: "left" as const, backgroundColor: currentView === view ? "#3e4b5b" : "transparent",
    color: "white", border: "1px solid #3e4b5b", borderRadius: "4px", cursor: "pointer", width: "100%", marginBottom: "5px"
  });

  return (
    <Authenticator>
      {({ signOut }) => (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gridTemplateRows: "70px 1fr 30px", height: "100vh", fontFamily: "sans-serif" }}>
          
          <header style={{ gridColumn: "1 / -1", backgroundColor: "#047d95", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px" }}>
            <div style={{ fontSize: "0.8rem" }}><div>ID: <strong>{userEmail}</strong></div><div>Ver: {lastLoginDisplay}</div></div>
            <div style={{ textAlign: "center" }}><h2 style={{ margin: 0 }}>PCI-DSS Audit GRC</h2><div style={{ fontSize: "0.6rem" }}>AUDIT CYCLE 2026 - SECURE PROTOTYPE</div></div>
            <div style={{ fontSize: "0.8rem", textAlign: "right" }}>{time.toLocaleString()}</div>
          </header>

          <nav style={{ backgroundColor: "#232f3e", color: "white", padding: "20px 15px" }}>
            <button onClick={() => setCurrentView("Dashboard")} style={navBtnStyle("Dashboard")}>📊 Dashboard</button>
            <button onClick={() => setCurrentView("Assets")} style={navBtnStyle("Assets")}>🖥️ Asset Inventory</button>
            <button onClick={() => setCurrentView("Controls")} style={navBtnStyle("Controls")}>🛡️ PCI Controls</button>
            <button onClick={() => setCurrentView("Evidence")} style={navBtnStyle("Evidence")}>📁 Evidence Vault</button>
            <button onClick={() => setCurrentView("Reports")} style={navBtnStyle("Reports")}>📋 Audit Reports</button>
            {userGroups.includes("ADMIN") && <button onClick={() => setCurrentView("Settings")} style={navBtnStyle("Settings")}>⚙️ Settings</button>}
            <div style={{ marginTop: "auto" }}><button onClick={signOut} style={{ width: "100%", padding: "10px", backgroundColor: "#d9534f", border: "none", color: "white", cursor: "pointer" }}>Logout</button></div>
          </nav>

          <main style={{ backgroundColor: "#f8fafc", padding: "20px", overflowY: "auto" }}>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "15px" }}>ROOT / {currentView}</div>

            {currentView === "Controls" && (
              <div>
                <h2>PCI-DSS Controls Management</h2>

                <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "10px" }}>Bulk Import from Excel:</label>
                  <input type="file" accept=".xlsx, .xls" onChange={handleControlExcelImport} />
                </div>

                <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "10px" }}>Or add a single control manually:</label>
                  <form onSubmit={handleAddControl} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Control Name</label>
                      <input value={newControlName} onChange={e => setNewControlName(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }} placeholder="e.g., Implement Strong Access Control Measures" />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Control Type</label>
                      <select value={newControlType} onChange={e => setNewControlType(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }}>
                        <option>PREVENTATIVE</option>
                        <option>DETECTIVE</option>
                        <option>REACTIVE</option>
                        <option>DIRECTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Control Measure</label>
                      <select value={newControlMeasure} onChange={e => setNewControlMeasure(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }}>
                        <option>ELIMINATION</option>
                        <option>SUBSTITUTION</option>
                        <option>ENGINEERING</option>
                        <option>ADMINISTRATIVE</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>PCI Requirement</label>
                      <input value={newControlRequirement} onChange={e => setNewControlRequirement(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }} placeholder="e.g., Requirement 7.1.1" />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "0.75rem" }}>Description</label>
                      <textarea value={newControlDescription} onChange={e => setNewControlDescription(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px", minHeight: "60px" }} placeholder="Detailed description of the control..." />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Status</label>
                      <select value={newControlStatus} onChange={e => setNewControlStatus(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }}>
                        <option>ACTIVE</option>
                        <option>INACTIVE</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
                      <button type="submit" style={{ padding: "8px 14px", background: "#047d95", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add Control</button>
                    </div>
                  </form>
                </div>

                <table style={{ width: "100%", background: "white", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead><tr style={{ background: "#f1f5f9", textAlign: "left" }}><th style={{padding: "10px"}}>Control Name</th><th>Type</th><th>Measure</th><th>Requirement</th><th>Status</th><th>Created By</th></tr></thead>
                  <tbody>
                    {pciControls.map(control => (
                      <tr key={control.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px" }}><strong>{control.controlName}</strong></td>
                        <td><span style={{ fontSize: "0.7rem", background: "#e2e8f0", padding: "2px 5px" }}>{control.controlType}</span></td>
                        <td><span style={{ fontSize: "0.7rem", background: "#f0e2e8", padding: "2px 5px" }}>{control.controlMeasure}</span></td>
                        <td style={{ fontSize: "0.85rem", color: "#666" }}>{control.pciRequirement || "N/A"}</td>
                        <td style={{ color: control.status === "ACTIVE" ? "green" : "red" }}>{control.status}</td>
                        <td style={{ fontSize: "0.85rem", color: "#666" }}>{control.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pciControls.length === 0 && <p style={{ textAlign: "center", padding: "20px", color: "#999" }}>No controls found. Import an Excel file or add one manually to begin.</p>}
              </div>
            )}

            {currentView === "Assets" && (
              <div>
                <h2>Technology Asset Inventory</h2>

                <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "10px" }}>Bulk Import from Excel (Req 2.4):</label>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} />
                </div>

                <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "10px" }}>Or add a single asset manually:</label>
                  <form onSubmit={handleAddAsset} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Asset ID</label>
                      <input value={newAssetId} onChange={e => setNewAssetId(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }} placeholder="Optional - auto-generated if blank" />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Name</label>
                      <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }} placeholder="Asset name" />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Type</label>
                      <select value={newAssetType} onChange={e => setNewAssetType(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }}>
                        <option>SERVER</option>
                        <option>APPLICATION</option>
                        <option>DATABASE</option>
                        <option>NETWORK</option>
                        <option>OTHER</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem" }}>Status</label>
                      <select value={newAssetStatus} onChange={e => setNewAssetStatus(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "6px" }}>
                        <option>ACTIVE</option>
                        <option>INACTIVE</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
                      <button type="submit" style={{ padding: "8px 14px", background: "#047d95", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add Asset</button>
                    </div>
                  </form>
                </div>

                <table style={{ width: "100%", background: "white", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead><tr style={{ background: "#f1f5f9", textAlign: "left" }}><th style={{padding: "10px"}}>Asset ID</th><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                  <tbody>
                    {assets.map(asset => (
                      <tr key={asset.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px" }}><strong>{asset.assetId}</strong></td>
                        <td>{asset.name}</td>
                        <td><span style={{ fontSize: "0.7rem", background: "#e2e8f0", padding: "2px 5px" }}>{asset.type}</span></td>
                        <td style={{ color: "green" }}>{asset.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assets.length === 0 && <p style={{ textAlign: "center", padding: "20px", color: "#999" }}>No assets found. Import an Excel file or add one manually to begin.</p>}
              </div>
            )}

            {currentView === "Dashboard" && (
              <div>
                <h2>Audit Readiness</h2>
                <p>Overview of PCI controls and compliance status.</p>
                {/* <button onClick={checkDBStatus} style={{ padding: "10px 20px", background: "#047d95", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>DB Check</button>
                {dbStatus && <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#333" }}>{dbStatus}</p>} */}
              </div>
            )}

            {currentView === "Settings" && (
              <div>
                <h2>Admin Settings</h2>
                <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
                  <h3>User Management</h3>
                  <p style={{ fontSize: "0.9rem", color: "#666" }}>Manage user groups and permissions</p>
                  
                  <div style={{ marginTop: "15px" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "10px", fontWeight: "bold" }}>Registered Users:</label>
                    {userProfiles.length > 0 ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                            <th style={{ padding: "10px" }}>Email</th>
                            <th style={{ padding: "10px" }}>Current Group</th>
                            <th style={{ padding: "10px" }}>Last Login</th>
                            <th style={{ padding: "10px" }}>Actions</th>
                          </tr>
                        npm install -g @aws-amplify/cli
                        amplify configure
                        amplify publish
                        </thead>
                        <tbody>
                          {userProfiles.map(profile => (
                            <tr key={profile.id} style={{ borderBottom: "1px solid #eee" }}>
                              <td style={{ padding: "10px" }}><strong>{profile.email}</strong></td>
                              <td style={{ padding: "10px" }}>
                                <span style={{ fontSize: "0.75rem", background: "#e8f4f8", padding: "4px 8px", borderRadius: "3px", fontWeight: "bold" }}>
                                  {getUserCurrentGroup(profile.email || "")}
                                </span>
                              </td>
                              <td style={{ padding: "10px", fontSize: "0.85rem", color: "#666" }}>
                                {profile.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "Never"}
                              </td>
                              <td style={{ padding: "10px" }}>
                                <button onClick={() => { setSelectedUserEmail(profile.email || ""); setShowGroupModal(true); }} style={{ padding: "6px 12px", background: "#047d95", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>
                                  Change Group
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: "#999" }}>No users registered yet.</p>
                    )}
                  </div>
                </div>

                <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <h3>System Groups</h3>
                  <p style={{ fontSize: "0.9rem", color: "#666" }}>Available user groups in the system</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" }}>
                    {["ADMIN", "AUDITOR", "ISA", "CONTROL", "VIEWER"].map(group => {
                      const membersCount = userGroupAssignments.filter(a => a.groupName === group).length;
                      return (
                        <div key={group} style={{ background: "#f8fafc", padding: "15px", borderRadius: "6px", border: "1px solid #ddd" }}>
                          <h4 style={{ margin: "0 0 8px 0" }}>{group}</h4>
                          <p style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 10px 0" }}>
                            {group === "ADMIN" && "Full system access and user management"}
                            {group === "AUDITOR" && "Can create and manage audit evidence"}
                            {group === "ISA" && "Information Security Administrator - full audit access"}
                            {group === "CONTROL" && "PCI Control management - CRUD operations on controls"}
                            {group === "VIEWER" && "Read-only access to dashboards"}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#999", margin: "0 0 8px 0" }}>Members: <strong>{membersCount}</strong></p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal for assigning users to groups */}
                {showGroupModal && (
                  <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
                    justifyContent: "center", alignItems: "center", zIndex: 1000
                  }}>
                    <div style={{
                      background: "white", padding: "30px", borderRadius: "8px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)", maxWidth: "400px", width: "90%"
                    }}>
                      <h3 style={{ margin: "0 0 20px 0" }}>Assign User to Group</h3>
                      
                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "8px", fontWeight: "bold" }}>User Email:</label>
                        <input
                          type="text"
                          value={selectedUserEmail}
                          disabled
                          style={{
                            width: "100%", padding: "10px", border: "1px solid #ddd",
                            borderRadius: "4px", backgroundColor: "#f5f5f5", fontSize: "0.9rem"
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "8px", fontWeight: "bold" }}>Select Group:</label>
                        <select
                          value={selectedGroup}
                          onChange={e => setSelectedGroup(e.target.value)}
                          style={{
                            width: "100%", padding: "10px", border: "1px solid #ddd",
                            borderRadius: "4px", fontSize: "0.9rem"
                          }}
                        >
                          <option value="ADMIN">ADMIN - Full system access</option>
                          <option value="AUDITOR">AUDITOR - Create and manage evidence</option>
                          <option value="ISA">ISA - Information Security Administrator</option>
                          <option value="CONTROL">CONTROL - PCI Control management</option>
                          <option value="VIEWER">VIEWER - Read-only access</option>
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => { setShowGroupModal(false); setSelectedUserEmail(""); setSelectedGroup("AUDITOR"); }}
                          style={{
                            padding: "10px 20px", background: "#e0e0e0", color: "#333",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.9rem"
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAssignUserToGroup}
                          style={{
                            padding: "10px 20px", background: "#047d95", color: "white",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold"
                          }}
                        >
                          Assign User
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <footer style={{ gridColumn: "1 / -1", backgroundColor: "#f1f5f9", color: "#64748b", display: "center", alignItems: "center", fontSize: "0.6rem", textAlign: "center" }}>
             CLASSIFICATION: CONFIDENTIAL | SYSTEM OF RECORD FOR PCI-DSS COMPLIANCE
          </footer>
        </div>
      )}
    </Authenticator>
  );
}






