export type TouringGroup = { id: string; name: string; invite_code: string; owner_id: string; status: 'waiting' | 'active' | 'finished'; created_at: string };
export type LiveLocation = { group_id: string; user_id: string; latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null; updated_at: string; display_name?: string };
