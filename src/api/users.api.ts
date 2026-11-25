import { usersAdapter } from "@/adapters/erp.adapters";

export interface UserBackend {
  id: string | number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  is_verified: boolean;
  date_joined?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserPayload extends Omit<UserBackend, "id" | "date_joined" | "created_at" | "updated_at"> {
  password?: string;
}

export const getUsers = async (search?: string): Promise<UserBackend[]> => {
  return usersAdapter.list(search);
};

export const getUser = async (id: string | number): Promise<UserBackend> => {
  return usersAdapter.getById(id);
};

export const createUser = async (data: CreateUserPayload): Promise<UserBackend> => {
  return usersAdapter.create(data);
};

export const updateUser = async ({
  id,
  data,
}: {
  id: string | number;
  data: Partial<CreateUserPayload>;
}): Promise<UserBackend> => {
  return usersAdapter.update(id, data);
};

export const deleteUser = async (id: string | number): Promise<void> => {
  return usersAdapter.delete(id);
};
