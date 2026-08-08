CREATE TABLE "sirens_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"turns" integer NOT NULL,
	"winner_name" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sirens_matches_matchId_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE "sirens_match_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"name" text NOT NULL,
	"won" boolean NOT NULL,
	"realms" integer DEFAULT 0 NOT NULL,
	"steals" integer DEFAULT 0 NOT NULL,
	"tributes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sirens_players" (
	"name_key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"total_realms" integer DEFAULT 0 NOT NULL,
	"total_steals" integer DEFAULT 0 NOT NULL,
	"total_tributes" integer DEFAULT 0 NOT NULL,
	"last_match_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sirens_match_players" ADD CONSTRAINT "sirens_match_players_match_id_sirens_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."sirens_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sirens_match_players_match_name_unique" ON "sirens_match_players" USING btree ("match_id","name");
