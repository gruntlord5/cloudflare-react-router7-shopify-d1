import { useEffect, useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useLoaderData, useFetcher } from "react-router";
import { 
  loadAllDatabaseSettings, 
  updateDatabaseSetting, 
  getDatabaseConfig,
  getDatabaseDebugInfo,
  type DatabaseKey 
} from "../utils/db.service";


/**
 * Loader function that runs on the server to prepare data for the route
 */
export const loader = async (args: LoaderFunctionArgs) => {
  // Authenticate the admin user before proceeding
  await authenticate.admin(args.request, args.context);
  
  // Add debugging to see what's in the context
  console.log("Context structure in loader:", getDatabaseDebugInfo(args.context));
  
  // Load data from all databases
  const databases = await loadAllDatabaseSettings(args.context);
  
  // Return data in the format expected by the UI
  const [db1, db2, db3] = databases;
  return Response.json({ 
    db1: { ...db1, dbAvailable: db1.dbAvailable },
    db2: { ...db2, dbAvailable: db2.dbAvailable },
    db3: { ...db3, dbAvailable: db3.dbAvailable }
  });
};

/**
 * Action function to handle form submissions
 */
export async function action(args: ActionFunctionArgs) {
  // Authenticate the admin user
  await authenticate.admin(args.request, args.context);
  
  // Parse the form data from the request
  const formData = await args.request.formData();
  const action = formData.get("action") as string;
  const dbTarget = formData.get("dbTarget") as string;
  
  // Handle different action types
  if (action === "updateSettings") {
    const isChecked = formData.get("isChecked") === "true";
    
    // Map UI database names to our service keys
    const dbKeyMap: Record<string, string> = {
      "DB1": "DB",
      "DB2": "DB2", 
      "DB3": "DB3"
    };
    
    const dbKey = dbKeyMap[dbTarget] || "DB";
    const result = await updateDatabaseSetting(args.context, dbKey, isChecked);
    
    // Return result with dbTarget for UI consistency
    return Response.json({
      ...result,
      dbTarget
    });
  }
  
  // Return error for unknown actions
  return Response.json({ success: false, error: "Unknown action" });
}

/**
 * Main component for the settings page
 */
export default function D1Example() {
  // Get the Shopify app bridge instance for UI interactions
  const shopify = useAppBridge();
  
  // Load data from our server loader function
  const { db1, db2, db3 } = useLoaderData();
  
  // Use React Router fetcher for form submissions without navigation
  const fetcher = useFetcher();
  
  // Local state management for DB1
  const [checkboxStateDB1, setCheckboxStateDB1] = useState(db1.isChecked);
  const [saveErrorDB1, setSaveErrorDB1] = useState("");
  const [tableDataDB1, setTableDataDB1] = useState(db1.allSettings);
  
  // Local state management for DB2
  const [checkboxStateDB2, setCheckboxStateDB2] = useState(db2.isChecked);
  const [saveErrorDB2, setSaveErrorDB2] = useState("");
  const [tableDataDB2, setTableDataDB2] = useState(db2.allSettings);

  // Local state management for DB3
  const [checkboxStateDB3, setCheckboxStateDB3] = useState(db3.isChecked);
  const [saveErrorDB3, setSaveErrorDB3] = useState("");
  const [tableDataDB3, setTableDataDB3] = useState(db3.allSettings);

  // Effect to handle fetcher state changes
  useEffect(() => {
    if (fetcher.data) {
      const { success, dbTarget, error, allSettings, isChecked } = fetcher.data;
      
      // Handle errors and update table data based on target database
      if (dbTarget === "DB3") {
        setSaveErrorDB3(!success && error ? error : "");
        if (success && allSettings) setTableDataDB3(allSettings);
        if (success && typeof isChecked !== 'undefined') setCheckboxStateDB3(isChecked);
      } else if (dbTarget === "DB2") {
        setSaveErrorDB2(!success && error ? error : "");
        if (success && allSettings) setTableDataDB2(allSettings);
        if (success && typeof isChecked !== 'undefined') setCheckboxStateDB2(isChecked);
      } else {
        setSaveErrorDB1(!success && error ? error : "");
        if (success && allSettings) setTableDataDB1(allSettings);
        if (success && typeof isChecked !== 'undefined') setCheckboxStateDB1(isChecked);
      }
    }
  }, [fetcher.data]);

  /**
   * Generic handler for checkbox state changes
   */
  const handleCheckboxChange = (dbTarget: string, checked: boolean) => {
    // Update local state
    if (dbTarget === "DB3") {
      setCheckboxStateDB3(checked);
    } else if (dbTarget === "DB2") {
      setCheckboxStateDB2(checked);
    } else {
      setCheckboxStateDB1(checked);
    }
    
    const dbAvailable = dbTarget === "DB3" ? db3.dbAvailable : 
                        dbTarget === "DB2" ? db2.dbAvailable : db1.dbAvailable;
    
    if (dbAvailable) {
      // Prepare form data for submission
      const formData = new FormData();
      formData.append("action", "updateSettings");
      formData.append("dbTarget", dbTarget);
      formData.append("isChecked", checked.toString());
      
      // Submit the form using the fetcher
      fetcher.submit(formData, { method: "post" });
      
      // Show a success toast notification
      shopify.toast.show(`Setting saved to ${dbTarget}`);
    } else {
      // Show warning if database is not available
      shopify.toast.show(`Database ${dbTarget} not available, setting not saved`);
    }
  };

  /**
   * Helper function to format timestamps to readable dates
   */
  const formatDate = (timestamp: number) => {
    return new Date(Number(timestamp)).toLocaleString();
  };

  /**
   * Render a database settings section for each DB
   */
  const renderDatabaseSection = (dbName: string, isChecked: boolean, onChange: (checked: boolean) => void, isAvailable: boolean, error: string) => (
    <s-stack direction="block" gap="tight">
      <s-checkbox
        checked={isChecked}
        disabled={fetcher.state !== "idle" || !isAvailable}
        onChange={(e) => onChange(e.target.checked)}
        label={isChecked ? `${dbName}: This box is checked` : `${dbName}: This box is not checked`}
      />
      {error && (
        <s-text tone="critical">Error: {error}</s-text>
      )}
      {!isAvailable && (
        <s-text tone="subdued">
          Note: Database {dbName} is not available. {dbName === "DB1" ? db1.error : dbName === "DB2" ? db2.error : db3.error}
        </s-text>
      )}
    </s-stack>
  );

  /**
   * Render a table for database contents
   */
  const renderDatabaseTable = (dbName: string, tableName: string, tableData: any[], isAvailable: boolean, error: string | null) => (
    <s-stack direction="block" gap="base">
      <s-heading level="3">{dbName}: {tableName}</s-heading>
      {isAvailable ? (
        <>
          {tableData && tableData.length > 0 ? (
            <s-table>
              <s-table-header-row>
                <s-table-header>Key</s-table-header>
                <s-table-header>Value</s-table-header>
                <s-table-header>Last Updated</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {tableData.map((row, index) => (
                  <s-table-row key={index}>
                    <s-table-cell>{row.key}</s-table-cell>
                    <s-table-cell>{row.value}</s-table-cell>
                    <s-table-cell>{formatDate(row.updated_at)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-text tone="subdued">
              No data available in {dbName}. Click the checkbox above to write test data.
            </s-text>
          )}
        </>
      ) : (
        <s-text tone="critical">{dbName} Error: {error}</s-text>
      )}
    </s-stack>
  );

  // Render the UI with web components
  return (
    <s-page>
      <TitleBar title="Multiple D1 Database Example" />
      
      {/* Database Settings Section */}
      <s-section heading="Database Settings">
        <s-paragraph>
          Toggle these checkboxes to write values to each database. Changes will be reflected in the table below.
        </s-paragraph>
        
        <s-stack direction="block" gap="large">
          {/* DB1 Settings */}
          {renderDatabaseSection(
            "DB1", 
            checkboxStateDB1, 
            (checked) => handleCheckboxChange("DB1", checked),
            db1.dbAvailable,
            saveErrorDB1
          )}
          
          {/* DB2 Settings */}
          {renderDatabaseSection(
            "DB2", 
            checkboxStateDB2, 
            (checked) => handleCheckboxChange("DB2", checked),
            db2.dbAvailable,
            saveErrorDB2
          )}
          
          {/* DB3 Settings */}
          {renderDatabaseSection(
            "DB3", 
            checkboxStateDB3, 
            (checked) => handleCheckboxChange("DB3", checked),
            db3.dbAvailable,
            saveErrorDB3
          )}
        </s-stack>
      </s-section>
      
      {/* Database Contents Section */}
      <s-section heading="Database Contents">
        <s-stack direction="block" gap="extra-large">
          {/* DB1 Contents */}
          {renderDatabaseTable("DB1", db1.tableName, tableDataDB1, db1.dbAvailable, db1.error)}
          
          {/* DB2 Contents */}
          {renderDatabaseTable("DB2", db2.tableName, tableDataDB2, db2.dbAvailable, db2.error)}
          
          {/* DB3 Contents */}
          {renderDatabaseTable("DB3", db3.tableName, tableDataDB3, db3.dbAvailable, db3.error)}
        </s-stack>
      </s-section>
    </s-page>
  );
}