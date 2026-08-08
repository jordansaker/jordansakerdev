CREATE TYPE "public"."sirens_result" AS ENUM('win', 'loss', 'draw');--> statement-breakpoint
CREATE TABLE "sirens_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"mode" text NOT NULL,
	"room_code" text,
	"ended_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"turns" integer NOT NULL,
	"winner_player_id" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sirens_matches_matchId_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE "sirens_match_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"player_id" text NOT NULL,
	"name" text NOT NULL,
	"result" "sirens_result" NOT NULL,
	"turn_order" integer NOT NULL,
	"realms_completed" integer DEFAULT 0 NOT NULL,
	"pearls_banked" integer DEFAULT 0 NOT NULL,
	"cards_stolen" integer DEFAULT 0 NOT NULL,
	"tributes_charged" integer DEFAULT 0 NOT NULL,
	"sirens_refusals_played" integer DEFAULT 0 NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer NOT NULL,
	"rating_delta" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sirens_players" (
	"player_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rating" integer NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"last_match_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sirens_match_players" ADD CONSTRAINT "sirens_match_players_match_id_sirens_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."sirens_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sirens_match_players_match_player_unique" ON "sirens_match_players" USING btree ("match_id","player_id");
