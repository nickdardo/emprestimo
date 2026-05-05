/**
 * GEPainel - Configuração do Supabase
 */

const SUPABASE_URL = 'https://efdwdjwncbwbgmcudizh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHdkanduY2J3YmdtY3VkaXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMyNDE4NjksImV4cCI6MjA0ODgxNzg2OX0.eHVTFvKfP_DEFmPH9IvqoFm-0zLkPn4ZQ4_-XmOoL0c';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
