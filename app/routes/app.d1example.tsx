import { useEffect, useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Page, Layout, Card, Text, BlockStack, Checkbox } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
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
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // Authenticate the admin user before proceeding
  await authenticate.admin(request, context);
  
  // Add debugging to see what's in the context
  console.log("Context structure in loader:", getDatabaseDebugInfo(context));
  
  // Load data from all databases
  const databases = await loadAllDatabaseSettings(context);
  
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
export async function action({ request, context }: ActionFunctionArgs) {
  // Authenticate the admin user
  await authenticate.admin(request, context);
  
  // Parse the form data from the request
  const formData = await request.formData();
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
    const result = await updateDatabaseSetting(context, dbKey, isChecked);
    
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
export default function Index() {
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
    <BlockStack gap="200">
      <Checkbox
        label={isChecked ? `${dbName}: This box is checked` : `${dbName}: This box is not checked`}
        checked={isChecked}
        disabled={fetcher.state !== "idle" || !isAvailable}
        onChange={onChange}
      />
      {error && (
        <Text as="p" variant="bodyMd" color="critical">
          Error: {error}
        </Text>
      )}
      {!isAvailable && (
        <Text as="p" variant="bodyMd" color="subdued">
          Note: Database {dbName} is not available. {dbName === "DB1" ? db1.error : dbName === "DB2" ? db2.error : db3.error}
        </Text>
      )}
    </BlockStack>
  );

  /**
   * Render a table for database contents
   */
  const renderDatabaseTable = (dbName: string, tableName: string, tableData: any[], isAvailable: boolean, error: string | null) => (
    <BlockStack gap="400">
      <Text as="h3" variant="headingSm">
        {dbName}: {tableName}
      </Text>
      {isAvailable ? (
        <>
          {tableData && tableData.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Key</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Value</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{row.key}</td>
                      <td style={{ padding: '8px' }}>{row.value}</td>
                      <td style={{ padding: '8px' }}>{formatDate(row.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Text as="p" variant="bodyMd" color="subdued">
              No data available in {dbName}. Click the checkbox above to write test data.
            </Text>
          )}
        </>
      ) : (
        <Text as="p" variant="bodyMd" color="critical">
          {dbName} Error: {error}
        </Text>
      )}
    </BlockStack>
  );

  // Render the UI with consolidated cards
  return (
    <Page title="Multiple D1 Database Example">
      <Layout>
        {/* Consolidated Settings Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Database Settings
              </Text>
              <Text as="p" variant="bodyMd">
                Toggle these checkboxes to write values to each database. Changes will be reflected in the table below.
              </Text>
              
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
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Consolidated Database Contents Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="600">
              <Text as="h2" variant="headingMd">
                Database Contents
              </Text>
              
              {/* DB1 Contents */}
              {renderDatabaseTable("DB1", db1.tableName, tableDataDB1, db1.dbAvailable, db1.error)}
              
              {/* Divider */}
              <div style={{ borderBottom: '1px solid #ddd', width: '100%' }}></div>
              
              {/* DB2 Contents */}
              {renderDatabaseTable("DB2", db2.tableName, tableDataDB2, db2.dbAvailable, db2.error)}
              
              {/* Divider */}
              <div style={{ borderBottom: '1px solid #ddd', width: '100%' }}></div>
              
              {/* DB3 Contents */}
              {renderDatabaseTable("DB3", db3.tableName, tableDataDB3, db3.dbAvailable, db3.error)}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}