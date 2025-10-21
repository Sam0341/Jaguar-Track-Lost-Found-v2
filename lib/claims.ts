// lib/claims.ts
import { supabase } from './supabaseClient';

export type Claim = {
  id: string;
  item_id: string;
  claimed_by: string; // ✅ matches DB column name
  message: string;
  status: string;
  created_at: string;
};

export async function addClaim(
  item_id: string,
  claimed_by: string, // ✅ renamed param
  message: string
): Promise<Claim> {
  const { data, error } = await supabase
    .from('claims')
    .insert([
      {
        item_id,
        claimed_by, // ✅ correct column name
        message,
        status: 'pending', // optional default
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding claim:', error.message);
    throw error;
  }

  return data as Claim;
}

export async function getClaimsByItem(item_id: string): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*, claimed_by')
    .eq('item_id', item_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Claim[];
}

export async function updateClaimStatus(id: string, status: string): Promise<Claim> {
  const { data, error } = await supabase
    .from('claims')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Claim;
}
